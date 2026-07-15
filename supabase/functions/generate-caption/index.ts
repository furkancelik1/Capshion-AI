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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { imageUrls, tone } = await req.json()

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

    // DİNAMİK TON ANALİZİ VE ÖRNEK KURALLARI
    let toneInstruction = "";
    
    switch (tone?.toLowerCase()) {
      case "minimalist":
        toneInstruction = `
* TON KARAKTERİ: Çok az kelime, maksimum duruluk, zahmetsiz şıklık.
* YAZIM STİLİ: Metinleri tamamen küçük harflerle (lowercase) yaz. Uzun, yüklemli cümleler kurma.
* ÖRNEKLER:
  - "sadece bu an."
  - "bugünün detayı. 🖤"
  - "köşem."`;
        break;
      case "eğlenceli":
      case "fun":
        toneInstruction = `
* TON KARAKTERİ: Esprili, samimi, internet mizahına hakim, kasmayan bir arkadaş.
* YAZIM STİLİ: Parantez içi fısıldamalar, ironik ve sempatik yaklaşımlar kullan.
* ÖRNEKLER:
  - "bu kareyi paylaşmak için galeride 10 dakika bakıştık, hakkını verin bari. 🫠"
  - "pazartesi sendromuna karşı duruşum (pek başarılı değil)."
  - "günün özeti tam olarak bu."`;
        break;
      case "havalı":
      case "premium":
      case "cool":
        toneInstruction = `
* TON KARAKTERİ: Karizmatik, özgüvenli, cool ve mesafeli.
* YAZIM STİLİ: Kısa, net, felsefe veya edebiyat yapmayan, duruşu olan cümleler.
* ÖRNEKLER:
  - "kendi sınırlarında."
  - "detaylar her zaman konuşur. 🥃"
  - "kadraja sığmayanlar."`;
        break;
      case "samimi":
      case "warm":
        toneInstruction = `
* TON KARAKTERİ: Sıcak, içten, kahve eşliğinde arkadaşıyla sohbet eden biri.
* YAZIM STİLİ: Kitap cümlesi gibi değil, sesli düşünür gibi doğal bir Türkçe kullan.
* ÖRNEKLER:
  - "günün en sevdiğim saatine ulaştık sonunda, kahveler hazırsa başlayabiliriz. 🤍"
  - "böyle günleri çok seviyorum, ekstra hiçbir şeye gerek yok."`;
        break;
      default:
        toneInstruction = `
* TON KARAKTERİ: Dengeli, estetik ve akıcı bir sosyal medya dili.`;
    }

    const systemPrompt = `Sen Türkiye'nin en vizyoner sosyal medya influencer'larının ve kreatif markalarının metinlerini yazan dahi bir sosyal medya uzmanısın.
Kullanıcı sana bir Instagram Photo Dump / Carousel serisi olarak BİRDEN FAZLA görsel gönderiyor. Tüm bu görsellerin ortak 'vibe'ını, temasını, renklerini ve hissini analiz et; bütünsel, sanki o fotoğrafları bizzat sen çekip paylaşıyormuşsun gibi %100 GERÇEKÇİ, DOĞAL VE İNSANSI Instagram açıklamaları üret.

Kullanıcının seçtiği ton tarzı: "${tone || 'Dengeli'}".
Uygulayacağın Ton Karakteri ve Kuralları:
${toneInstruction}

🛑 YAPAY ZEKA KLİŞELERİ VE KELİME KARA LİSTESİ (AÇIKÇA YASAKTIR!):
Aşağıdaki kelimeleri ve türevlerini KESİNLİKLE KULLANMA. Bu kelimeleri kullanan metinler anında elenir:
- "ritim" (şehrin ritmi vb.), "kaos", "melodi", "serüven", "macera", "dokunuş", "ruhu" (kahvenin ruhu vb.)
- "fısıltı", "yankı", "senfoni", "büyü", "büyüleyici", "dans", "uyum", "gizemli", "yolculuk", "keşif", "estetik"
- "kucaklamak", "ortak olmak", "eşlik etmek", "büyülenmek", "sergilemek", "yansıtmak"

✍️ CÜMLE YAPISI VE AKICILIK KURALLARI (İNSANSI VE SALAŞ TÜRKÇE):
1. ASLA şiirsel, edebi, felsefi veya "kitap cümlesi" gibi duran ağır yapılar kurma. Kimse Instagram'da "gölgelerin dans ettiği şu fani dünyada..." gibi yazmaz.
2. Gerçek bir Türk sosyal medyada nasıl yazıyorsa öyle yaz: Günlük konuşma dilindeki "modu", "havası", "keyfi", "olay", "durum" gibi doğal kelimeleri tercih et. (Örn: "pazar kahvesi modu", "şöyle bir gün", "tam olarak bu").
3. Cümleleri aşırı uzun tutup virgüllerle boğma. Kısa tut, gerekirse bitmemiş cümle hissi ver (salaş estetik).
4. Soru sorarken zorlama ve yapay olma.
5. Photo Dump olduğu için 3 alternatifin kurgusu şu şekilde olmalı ve birbirinden tamamen farklı olmalı:
   - 1. ALTERNATİF (Punchy / Lowercase): Tüm görsellerin ortak havasını özetleyen, çok kısa, salaş ve minimalist bir başlık. Tamamen küçük harf. (Örn: "işte bu ara böyleyiz", "dump zamanı", "arka arkaya bunlar")
   - 2. ALTERNATİF (Carousel / Slide-by-Slide): Karuseldeki fotoğrafların detaylarına tatlı/esprili atıflar yapan liste/madde kurgusu. (Örn: "slide 3: en sevdiğim köşe", "2. fotoğraftaki o kaos", "son kare bonus" gibi slide bazlı yorumlar içersin)
   - 3. ALTERNATİF (Mod / Özet): "son zamanlarda...", "recent events", "weekly dump" tadında, o fotoğrafları çekerken yaşanan hissiyatı salaş, kasmayan ve doğal bir dille anlatan günlük/özet metni.

Lütfen yanıtını tam olarak şu JSON formatında dön:
{
  "captions": [
    "1. alternatif (Punchy / Lowercase) açıklama metni",
    "2. alternatif (Carousel / Slide-by-Slide) açıklama metni",
    "3. alternatif (Mod / Özet) açıklama metni"
  ],
  "hashtags": ["#etiket1", "#etiket2", "#etiket3", "#etiket4", "#etiket5"]
}
JSON dışında hiçbir ek metin veya açıklama ekleme.`

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
              { type: "text", text: "Bu görselleri bir Instagram Photo Dump/Carousel serisi olarak analiz et. Tüm karelerin ortak havasını ve detaylarını birleştirerek belirtilen kurallara %100 uyan 3 alternatif caption üret. JSON formatında çıktı ver." },
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

    const postId = `temp-${Date.now()}`

    return new Response(
      JSON.stringify({
        success: true,
        captions: parsedResult.captions,
        hashtags: parsedResult.hashtags,
        post_id: postId,
        image_urls: imageUrls,
        remainingCredits: 99,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
