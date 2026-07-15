import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        db: { schema: 'public' },
        auth: { persistSession: false }
      }
    )

    const { imageUrls, tone, gender, ageRange } = await req.json()

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Eksik parametre: imageUrls (dizi) zorunludur ve en az bir URL içermelidir.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API Anahtarı sunucuda tanımlı değil.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const ageStyle = ageRange === "18-24"
      ? "Daha genç, samimi, trend ve dijital dille yaz. Güncel sosyal medya akışlarına hakim bir üslup kullan."
      : ageRange === "25-34"
      ? "Dengeli, olgun ama modern bir dil kullan. Profesyonellik ile samimiyet arasında bir ton tercih et."
      : ageRange === "35-44" || ageRange === "45+"
      ? "Daha olgun, güven veren, sofistike ve zamansız bir dil kullan. Abartıdan uzak, duru bir anlatım tercih et."
      : "Doğal ve her yaşa hitap eden dengeli bir dil kullan."

    const genderStyle = gender === "erkek" || gender === "male"
      ? "Maskülen, özgüvenli, kısa ve cool bir dil kullan. Gereksiz sıfatlardan kaçın, az ve öz yaz."
      : gender === "kadın" || gender === "female"
      ? "Estetik, sofistike, etkileyici ve akıcı bir dil kullan. Zarif ve hisli bir anlatım tercih et."
      : "Dengeli ve doğal bir üslup kullan, cinsiyet vurgusu yapma."

    const systemPrompt = `Sen gerçek bir sosyal medya kullanıcısısın. Bir arkadaşının fotoğrafına yorum yapar gibi doğal ve samimi caption'lar yazıyorsun.

🚨 BU KURALLARIN İHLALİ KESİNLİKLE YASAKTIR:
1. TEK GÖRSEL KURALI: Kullanıcı SADECE 1 (BİR) fotoğraf yükledi. ASLA "slide 1", "slayt", "görsel 1", "fotoğraf 2", "ilk kare", "sonraki slide", "carousel", "dump", "kaydır", "sonraki kare", "1/3", "2/3" gibi numaralandırılmış veya çoklu görsel kurgusu barındıran hiçbir ibare kullanma. Her alternatif tek bir fotoğrafa ait tek parça, akıcı bir metin olmalıdır.
2. ${genderStyle}
3. ${ageStyle}
4. ASLA yapay, robotik veya spam metin yazma. Etkileşim kasmak için soru sorma, "beğenmeyi unutma" gibi ifadeler kullanma. Gerçek bir insan gibi yaz.
5. Aşırı emoji kullanma. Maksimum 1 emoji, sadece doğal akışta gerekiyorsa.
6. Çıktıyı SADECE JSON formatında ver. Açıklama, not veya başka metin ekleme.

Kullanıcının tonu: ${tone || 'Dengeli'} | Cinsiyet: ${gender || 'nötr'} | Yaş: ${ageRange || 'belirtilmemiş'}

{"captions":["1. alternatif","2. alternatif","3. alternatif"],"hashtags":["#etiket1","#etiket2","#etiket3","#etiket4","#etiket5"]}`

    const imageContentParts = imageUrls.map((url: string) => ({
      type: "image_url",
      image_url: { url }
    }))

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: `Bu görseli analiz et ve tek kareye uygun 3 alternatif caption üret. JSON formatında çıktı ver.` },
              ...imageContentParts
            ]
          }
        ],
        max_tokens: 600,
        temperature: 0.9,
        response_format: { type: "json_object" }
      })
    })

    const openAiData = await openAiResponse.json()
    
    if (!openAiResponse.ok) {
      throw new Error(`OpenAI Hatası: ${openAiData.error?.message || 'Bilinmeyen Hata'}`)
    }

    const aiContent = openAiData.choices[0].message.content

    let parsedResult
    try {
      parsedResult = JSON.parse(aiContent)
    } catch (e) {
      const jsonRegex = /\{[\s\S]*\}/
      const match = aiContent.match(jsonRegex)
      if (match) {
        parsedResult = JSON.parse(match[0])
      } else {
        throw new Error('Yapay zeka çıktısı JSON formatına dönüştürülemedi.')
      }
    }

    // 🚀 BÖLÜM 1: KULLANICIYI TESPİT ETME
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    const { data: { user } } = await supabaseClient.auth.getUser(token ?? '')

    // 🚀 DOĞRU SÜTUN ADIYLA GÜNCELLENMİŞ KISIM:
const postInsertData: any = {
  image_url: imageUrls[0], // Geriye dönük uyumluluk
  image_urls: imageUrls,   // Yeni çoklu görsel desteği
  selected_tone: tone      // 👈 'tone' olan anahtar adını 'selected_tone' yaptık!
}
    
    // Eğer kullanıcı giriş yapmışsa user_id'yi ekle
    if (user) {
      postInsertData.user_id = user.id
    }

    const { data: savedPost, error: postError } = await supabaseClient
      .from('posts')
      .insert(postInsertData)
      .select()
      .single()

    if (postError) {
      throw new Error(`Post veritabanına kaydedilemedi: ${postError.message}`)
    }

    // 🚀 BÖLÜM 3: ÜRETİLEN CAPTION'LARI VERİTABANINA KAYDETME
    const captionInserts = parsedResult.captions.map((item: string) => ({
      post_id: savedPost.id,
      caption_text: item,
      hashtags: parsedResult.hashtags
    }))

    const { error: captionsError } = await supabaseClient
      .from('generated_captions')
      .insert(captionInserts)

    if (captionsError) {
      console.error("Caption'lar kaydedilirken hata oluştu:", captionsError.message)
    }

    return new Response(
      JSON.stringify({
        success: true,
        captions: parsedResult.captions,
        hashtags: parsedResult.hashtags,
        post_id: savedPost.id, // Artık gerçek veritabanı ID'sini dönüyoruz
        image_urls: imageUrls,
        remainingCredits: 99,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("Fonksiyon Hatası Detayı:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Bilinmeyen Sunucu Hatası' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})