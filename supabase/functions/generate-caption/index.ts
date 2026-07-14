import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ error: "Yetkilendirme gerekli" }, 401);
      }

      const { data: { user }, error: authError } =
        await ctx.supabaseAdmin.auth.getUser(authHeader.slice(7));

      if (authError || !user) {
        return jsonResponse({ error: "Geçersiz token" }, 401);
      }

      const { imageUrl, tone } = await req.json();

      if (!imageUrl || !tone) {
        return jsonResponse(
          { error: "imageUrl ve tone alanları zorunludur" },
          400,
        );
      }

      const { data: profile, error: profileError } = await ctx.supabaseAdmin
        .from("profiles")
        .select("credits")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        return jsonResponse({ error: "Profil bulunamadı" }, 404);
      }

      if (profile.credits <= 0) {
        return jsonResponse({ error: "Yetersiz kredi" }, 403);
      }

      const geminiKey = Deno.env.get("GEMINI_API_KEY");
      if (!geminiKey) {
        return jsonResponse(
          { error: "API anahtarı yapılandırılmamış" },
          500,
        );
      }

      const prompt = `Sana gönderilen görseli detaylıca analiz et. Bu görsele ve seçilen '${tone}' tonuna uygun olarak Instagram'da paylaşılabilecek, dikkat çekici, samimi ve organik duran 3 farklı alternatif açıklama (caption) ve bunlara uygun hashtag listeleri üret. Yanıtı kesinlikle şu JSON formatında dön: 
{
  "captions": [
    { "text": "açıklama metni", "hashtags": ["tag1", "tag2"] },
    { "text": "açıklama metni", "hashtags": ["tag3", "tag4"] },
    { "text": "açıklama metni", "hashtags": ["tag5", "tag6"] }
  ]
}`;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { fileData: { mimeType: "image/jpeg", fileUri: imageUrl } },
                { text: prompt },
              ],
            }],
          }),
        },
      );

      const geminiData = await geminiRes.json();

      if (!geminiRes.ok) {
        console.error("Gemini API hatası:", JSON.stringify(geminiData));
        return jsonResponse({ error: "Yapay zeka servisi hatası" }, 502);
      }

      const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        return jsonResponse({ error: "Yapay zeka yanıtı boş" }, 502);
      }

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);

      if (!parsed?.captions?.length) {
        return jsonResponse({ error: "Geçersiz yapay zeka yanıtı" }, 502);
      }

      const { data: post, error: postError } = await ctx.supabaseAdmin
        .from("posts")
        .insert({ user_id: user.id, image_url: imageUrl, tone })
        .select("id")
        .single();

      if (postError || !post) {
        console.error("Post ekleme hatası:", postError);
        return jsonResponse({ error: "Kayıt oluşturulamadı" }, 500);
      }

      const captionRecords = parsed.captions.map(
        (c: { text: string; hashtags: string[] }) => ({
          post_id: post.id,
          text: c.text,
          hashtags: c.hashtags,
        }),
      );

      const { error: captionsError } = await ctx.supabaseAdmin
        .from("generated_captions")
        .insert(captionRecords);

      if (captionsError) {
        console.error("Caption ekleme hatası:", captionsError);
      }

      const { error: updateError } = await ctx.supabaseAdmin
        .from("profiles")
        .update({ credits: profile.credits - 1 })
        .eq("id", user.id);

      if (updateError) {
        console.error("Kredi güncelleme hatası:", updateError);
      }

      return jsonResponse({
        captions: parsed.captions,
        credits_remaining: profile.credits - 1,
      });
    } catch (err) {
      console.error("Beklenmeyen hata:", err);
      return jsonResponse({ error: "Sunucu hatası" }, 500);
    }
  }),
};
