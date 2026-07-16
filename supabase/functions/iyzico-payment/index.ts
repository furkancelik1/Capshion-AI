import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0'
// Resmi Iyzipay NPM kütüphanesini doğrudan import ediyoruz
import Iyzipay from 'npm:iyzipay'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Auth header eksik' }), { status: 401, headers: corsHeaders })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Geçersiz token' }), { status: 401, headers: corsHeaders })
    }

    const { price, credits } = await req.json()
    const numericPrice = parseFloat(price) || 50
    const numericCredits = parseInt(credits, 10) || 10
    const priceStr = numericPrice.toFixed(1)

    const conversationId = crypto.randomUUID()
    const basketId = `B_${crypto.randomUUID().substring(0, 8)}`

    const apiKey = Deno.env.get('IYZICO_API_KEY') || ''
    const secretKey = Deno.env.get('IYZICO_SECRET_KEY') || ''
    const uri = Deno.env.get('IYZICO_BASE_URL') || 'https://sandbox-api.iyzipay.com'

    if (!apiKey || !secretKey) {
      throw new Error("İyzico API anahtarları eksik.")
    }

    // İyzipay sınıfını anahtarlarımızla başlatıyoruz
    const iyzipay = new Iyzipay({
      apiKey: apiKey,
      secretKey: secretKey,
      uri: uri
    });

    const callbackUrl = `https://rkacxgouberhvygsefqu.supabase.co/functions/v1/iyzico-payment-callback`

    const requestData = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: conversationId,
      price: priceStr,
      paidPrice: priceStr,
      currency: Iyzipay.CURRENCY.TRY,
      basketId: basketId,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: callbackUrl,
      enabledInstallments: [1],
      buyer: {
        id: user.id,
        name: "Furkan",
        surname: "User",
        gsmNumber: "+905000000000",
        email: user.email,
        identityNumber: "11111111111", 
        lastLoginDate: "2023-01-01 10:00:00",
        registrationDate: "2023-01-01 10:00:00",
        registrationAddress: "Gonen, Balikesir",
        ip: "85.34.78.112",
        city: "Balikesir",
        country: "Turkey",
        zipCode: "10900"
      },
      shippingAddress: {
        contactName: "Furkan User",
        city: "Balikesir",
        country: "Turkey",
        address: "Gonen, Balikesir",
        zipCode: "10900"
      },
      billingAddress: {
        contactName: "Furkan User",
        city: "Balikesir",
        country: "Turkey",
        address: "Gonen, Balikesir",
        zipCode: "10900"
      },
      basketItems: [
        {
          id: "CREDIT_PKG",
          name: `${numericCredits} Yapay Zeka Kredisi`,
          category1: "Digital Service",
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price: priceStr
        }
      ]
    };

    // İyzico'nun şifreleme ve fetch sürecini kendi kütüphanesine devrediyoruz
    const result: any = await new Promise((resolve, reject) => {
      iyzipay.checkoutFormInitialize.create(requestData, function (err: any, res: any) {
        if (err) reject(err);
        else resolve(res);
      });
    });

    if (result.status !== "success") {
      console.error("İyzico API reddetti:", result.errorMessage)
      throw new Error(result.errorMessage || "Ödeme formu başlatılamadı.")
    }

    try {
      await supabaseClient
        .from('payments')
        .insert({
          user_id: user.id,
          conversation_id: conversationId,
          basket_id: basketId,
          amount: numericPrice,
          credits_to_add: numericCredits,
          status: 'pending'
        })
    } catch (dbError) {
      console.error("Veritabanı kaydı atılamadı:", dbError)
    }

    return new Response(
      JSON.stringify({ paymentUrl: result.paymentPageUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Edge Function içinde kritik hata:', error.message)
    return new Response(JSON.stringify({ error: error.message || 'Ödeme başlatılamadı.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})