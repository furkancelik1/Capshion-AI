import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS (Ön uçuş) isteğini onayla
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Yetkilendirme Kontrolü (Token)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Yetkisiz erişim: Auth header eksik.' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Geçersiz veya süresi dolmuş token.' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // 2. Kredi Bakiye Kontrolü
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('credits_remaining')
      .eq('id', user.id)
      .single()

    // Hata 1: Veritabanı sorgusunda bir hata varsa
    if (profileError) {
      return new Response(JSON.stringify({ 
        error: `Profil sorgu hatası: ${profileError.message}` 
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Hata 2: Kullanıcının profiles tablosunda satırı yoksa
    if (!profile) {
      return new Response(JSON.stringify({ 
        error: `Profil bulunamadı! Aranan User ID: ${user.id}` 
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Hata 3: Kredi gerçekten 0 veya altındaysa
    if (profile.credits_remaining <= 0) {
      return new Response(JSON.stringify({ 
        error: `Sistemdeki güncel bakiyen: ${profile.credits_remaining}. Lütfen kredi satın alın.` 
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. Frontend'den gelen verileri al
    const body = await req.json()
    const { imageUrls, tone, gender, ageRange } = body

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      throw new Error('Görsel URL listesi eksik veya hatalı.')
    }

    // 4. OpenAI'a Gönderilecek Mesajı Hazırlama (Vision Modeli)
    // Gönderilen tüm resimleri OpenAI'ın anlayacağı formata çeviriyoruz
    const imageContents = imageUrls.map((url: string) => ({
      type: "image_url",
      image_url: { url: url }
    }))

    const promptText = `
      Sen profesyonel bir sosyal medya uzmanısın. Kullanıcının gönderdiği görselleri analiz ederek etkileyici sosyal medya altyazıları (caption) üreteceksin.
      - Dil: Türkçe
      - Hedef Kitle Yaş Aralığı: ${ageRange || 'Belirtilmedi'}
      - İstenen Ton: ${tone || 'Doğal'}
      - Karakter/Cinsiyet Yansıması: ${gender || 'Nötr'}
      
      Lütfen tam olarak 3 farklı altyazı seçeneği ve konuyla ilgili 5 ila 8 adet popüler hashtag üret.
      Yanıtını KESİNLİKLE aşağıdaki JSON formatında ver:
      {
        "captions": ["Açıklama 1", "Açıklama 2", "Açıklama 3"],
        "hashtags": ["#etiket1", "#etiket2"]
      }
    `

    // 5. OpenAI API İsteği
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Vision destekli en güncel model
        response_format: { type: "json_object" }, // JSON dönmeye zorluyoruz
        messages: [
          { role: 'system', content: promptText },
          { 
            role: 'user', 
            content: [
              { type: "text", text: "Bu görseller için istenen ayarlarda altyazı üret." },
              ...imageContents
            ] 
          }
        ]
      })
    })

    const aiData = await openAiResponse.json()
    if (!openAiResponse.ok) {
      console.error('OpenAI Hatası:', aiData)
      throw new Error('Yapay zeka üretimi sırasında bir hata oluştu.')
    }

    // OpenAI'dan gelen JSON'ı parse et
    const generatedResult = JSON.parse(aiData.choices[0].message.content)
    const generatedCaptions = generatedResult.captions || []
    const generatedHashtags = generatedResult.hashtags || []

    // 6. Veritabanına Postu Kaydetme (Geçmişte görebilmek için)
    const { data: postData, error: postError } = await supabaseClient
      .from('posts')
      .insert({
        user_id: user.id,
        image_urls: imageUrls,
        captions: generatedCaptions,
        hashtags: generatedHashtags,
        tone: tone,
        status: 'completed'
      })
      .select('id')
      .single()

    // Eğer veritabanında 'posts' tablon yoksa burası hata verir. Şimdilik rastgele bir UUID atıyoruz.
    const postId = postData?.id || crypto.randomUUID()

    // 7. Krediyi Düşme İşlemi (Tahsilat)
    const newCreditBalance = profile.credits_remaining - 1
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ credits_remaining: newCreditBalance })
      .eq('id', user.id)

    if (updateError) {
      console.error('Kredi düşme hatası:', updateError)
      // Önemli uyarı: Kredi düşemezse işlemi yine de veriyoruz ama logluyoruz. 
      // İsteğe bağlı olarak burada exception fırlatabilirsin.
    }

    // 8. Frontend'in Beklediği Formatta Yanıt Dön
    return new Response(
      JSON.stringify({
        success: true,
        captions: generatedCaptions,
        hashtags: generatedHashtags,
        post_id: postId,
        image_urls: imageUrls,
        remainingCredits: newCreditBalance
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('Caption Error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Beklenmeyen bir sunucu hatası.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})