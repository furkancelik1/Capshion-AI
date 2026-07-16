import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0'

const IYZICO_API_KEY = Deno.env.get('IYZICO_API_KEY') ?? ''
const IYZICO_SECRET_KEY = Deno.env.get('IYZICO_SECRET_KEY') ?? ''
const IYZICO_BASE_URL = Deno.env.get('IYZICO_BASE_URL') ?? 'https://sandbox-api.iyzipay.com'

// Yönlendirme adreslerini doğrudan bu fonksiyonun kendisine bağlıyoruz
const SUCCESS_URL = 'https://rkacxgouberhvygsefqu.supabase.co/functions/v1/iyzico-payment-callback?status=success'
const FAILURE_URL = 'https://rkacxgouberhvygsefqu.supabase.co/functions/v1/iyzico-payment-callback?status=failure'

function generateRnd(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let rnd = ''
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < bytes.length; i++) {
    rnd += chars[bytes[i] % chars.length]
  }
  return rnd
}

async function createSignature(apiKey: string, rnd: string, secretKey: string, payload: string): Promise<string> {
  const dataStr = apiKey + rnd + secretKey + payload
  const encoder = new TextEncoder()
  const data = encoder.encode(dataStr)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return btoa(String.fromCharCode(...hashArray))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');

  const htmlHeaders = new Headers();
  htmlHeaders.set("Content-Type", "text/html; charset=utf-8");

  // BAŞARI HTML SAYFASI
  if (statusParam === 'success') {
    const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ödeme Başarılı</title>
    <style>
      body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #0F0F1E; color: white; text-align: center; }
      .card { padding: 30px; border-radius: 20px; background: #16162a; border: 1px solid #2a2a4a; max-width: 90%; }
      h1 { color: #4BB543; margin-bottom: 10px; font-size: 24px; }
      p { color: #b3b3cc; font-size: 16px; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Ödeme Başarılı! 🎉</h1>
      <p>Kredileriniz hesabınıza yüklenmiştir.<br>Bu pencere otomatik olarak kapanacaktır.</p>
    </div>
  </body>
</html>`;
    return new Response(htmlContent, { status: 200, headers: htmlHeaders });
  }

  // HATA HTML SAYFASI
  if (statusParam === 'failure') {
    const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ödeme Başarısız</title>
    <style>
      body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #0F0F1E; color: white; text-align: center; }
      .card { padding: 30px; border-radius: 20px; background: #16162a; border: 1px solid #2a2a4a; max-width: 90%; }
      h1 { color: #ff3b30; margin-bottom: 10px; font-size: 24px; }
      p { color: #b3b3cc; font-size: 16px; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Ödeme Başarısız ❌</h1>
      <p>İşlem gerçekleştirilemedi. Lütfen kart bilgilerinizi kontrol edip tekrar deneyin.</p>
    </div>
  </body>
</html>`;
    return new Response(htmlContent, { status: 200, headers: htmlHeaders });
  }

  try {
    let token = '';
    const bodyText = await req.text();

    console.log("İyzico'dan callback isteği geldi. Gövde:", bodyText);

    if (bodyText && bodyText.includes('token=')) {
      const params = new URLSearchParams(bodyText);
      token = params.get('token') ?? '';
    } else if (bodyText) {
      try {
        const jsonBody = JSON.parse(bodyText);
        token = jsonBody.token ?? '';
      } catch (_) {
        // Hata durumunda sessizce geç
      }
    }

    if (!token) {
      console.error('iyzico callback tetiklendi fakat token bulunamadi.');
      return Response.redirect(FAILURE_URL, 303);
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const retrievePayload = { locale: 'tr', token };
    const bodyStr = JSON.stringify(retrievePayload);
    const pkiStr = `[locale=tr,token=${token}]`;
    const rnd = generateRnd();
    const signature = await createSignature(IYZICO_API_KEY, rnd, IYZICO_SECRET_KEY, pkiStr);

    console.log("İyzico ödeme detayı sorgulanıyor... Token:", token);

    const retrieveResponse = await fetch(`${IYZICO_BASE_URL}/payment/iyzipos/checkoutform/auth/ecom/detail`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-iyzi-rnd': rnd,
        'Authorization': `IYZWS ${IYZICO_API_KEY}:${signature}`,
      },
      body: bodyStr,
    });

    const retrieveResult = await retrieveResponse.json();
    console.log("İyzico Detay Sonucu:", JSON.stringify(retrieveResult));

    if (retrieveResult.status === 'success' && (retrieveResult.paymentStatus === 'SUCCESS' || retrieveResult.paymentStatus === 'INIT_THREEDS')) {
      const conversationId = retrieveResult.conversationId;
      const basketId = retrieveResult.basketId;

      console.log(`Ödeme Başarılı! Eşleşme aranıyor... ConversationId: ${conversationId}, BasketId: ${basketId}`);

      // YENİ HALİ: conversation_id ve basket_id için daha esnek bir yapı
      
const { data: paymentData, error: findError } = await supabaseClient
  .from('payments')
  .select('*')
  .or(`conversation_id.eq.${conversationId},basket_id.eq.${basketId}`)
  .maybeSingle();

      if (findError) {
        console.error("Ödeme kaydı sorgulanırken hata oluştu:", findError);
      }

      if (!paymentData) {
        console.error("HATA: Veritabanında bu ödemeye ait hiçbir kayıt ('payments') bulunamadı!");
        return Response.redirect(FAILURE_URL, 303);
      }

      console.log("Bulunan ödeme kaydı:", paymentData);

      if (paymentData.status === 'completed') {
        console.log("Bu ödeme zaten daha önce başarıyla işlenmiş.");
        return Response.redirect(SUCCESS_URL, 303);
      }

      // 1. Ödeme durumunu güncelle
      const { error: updatePayError } = await supabaseClient
        .from('payments')
        .update({ status: 'completed' })
        .or(`conversation_id.eq.${conversationId},basket_id.eq.${basketId}`);

      if (updatePayError) {
        console.error("Payments tablosu güncellenirken hata oluştu:", updatePayError);
      }

      // 2. Kullanıcı bakiyesini (credits_remaining) arttır
      if (paymentData.user_id) {
        const { data: profile, error: profileError } = await supabaseClient
          .from('profiles')
          .select('credits_remaining')
          .eq('id', paymentData.user_id)
          .single();

        if (profileError) {
          console.error("Kullanıcı profili okunurken hata:", profileError);
        }
          
        if (profile) {
          const currentCredits = profile.credits_remaining ?? 0;
          const creditsToAdd = paymentData.credits_to_add ?? 10;
          const newCredits = currentCredits + creditsToAdd;

          console.log(`Eski bakiye: ${currentCredits}, Eklenecek: ${creditsToAdd}, Yeni Bakiye: ${newCredits}`);

          const { error: updateProfileError } = await supabaseClient
            .from('profiles')
            .update({ credits_remaining: newCredits })
            .eq('id', paymentData.user_id);

          if (updateProfileError) {
            console.error("Profil bakiye güncelleme hatası:", updateProfileError);
          } else {
            console.log("Bakiye başarıyla güncellendi!");
          }
        }
      }

      return Response.redirect(SUCCESS_URL, 303);
    } else {
      console.error('iyzico ödeme detayı başarısız döndü veya ödeme onaylanmadı:', retrieveResult);
      return Response.redirect(FAILURE_URL, 303);
    }

  } catch (error) {
    console.error('Callback süreç hatası:', error);
    return Response.redirect(FAILURE_URL, 303);
  }
})