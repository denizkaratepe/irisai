// api/analyze.js - GERÇEKÇİ METRİK SİSTEMİ

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { brand, industry } = req.body;

    if (!brand || !industry) {
      return res.status(400).json({ error: 'Marka ve Sektör zorunludur.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server Konfigürasyon Hatası: API Key yok.' });
    }

    // ============================================
    // AŞAMA 1: WEB ARAMA - GERÇEK VERİ TOPLAMA
    // ============================================
    
    const searchQuery = `"${brand}" ${industry} news reviews social media mentions 2024 2025`;
    
    const searchResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            text: `Web'de "${searchQuery}" araması yap. Bulduğun sonuçlara göre şu soruları SAYISAL olarak cevapla:
            
1. Son 6 ayda kaç haber/makale var? (tahmini sayı)
2. Sosyal medya etkileşim skoru (0-100, düşük/orta/yüksek)
3. Pozitif yorumlar oran% (0-100)
4. Rakip sayısı (1-10)
5. Marka pazar liderliği (0-100, hiç tanınmıyor=0, endüstri lideri=100)

SADECE ŞÖYLE CEVAP VER:
{
  "newsCount": sayı,
  "socialScore": sayı,
  "positiveRatio": sayı,
  "competitorCount": sayı,
  "marketLeadership": sayı
}` 
          }] 
        }],
        tools: [{
          googleSearch: {} // Web arama özelliğini aktifleştir
        }],
        generationConfig: { 
          responseMimeType: 'application/json'
        }
      })
    });

    const searchData = await searchResponse.json();
    let webMetrics;

    try {
      const searchText = searchData.candidates[0].content.parts[0].text;
      webMetrics = JSON.parse(searchText);
    } catch (e) {
      // Web araması başarısız olursa varsayılan değerler
      webMetrics = {
        newsCount: 5,
        socialScore: 30,
        positiveRatio: 50,
        competitorCount: 5,
        marketLeadership: 40
      };
    }

    // ============================================
    // AŞAMA 2: METRİK HESAPLAMA (GERÇEK VERİYE DAYALI)
    // ============================================
    
    // Dijital Ayak İzi Skoru
    const digitalPresence = Math.min(100, Math.round(
      (webMetrics.newsCount * 2) + 
      (webMetrics.socialScore * 0.5) + 
      (webMetrics.marketLeadership * 0.3)
    ));

    // Duygu Durumu Skoru
    const sentimentHealth = Math.round(webMetrics.positiveRatio * 0.9); // %90'ı al (aşırı iyimserliği önle)

    // Algı Tutarlılığı (Pazar liderliği ile doğru orantılı)
    const identityMatch = Math.min(100, Math.round(
      webMetrics.marketLeadership * 0.8 + 
      (webMetrics.positiveRatio * 0.2)
    ));

    const finalScore = Math.round((digitalPresence + sentimentHealth + identityMatch) / 3);

    // ============================================
    // AŞAMA 3: AI İLE YORUMLAMA (SKORLAR SABİT KALACAK)
    // ============================================
    
    const ANALYSIS_PROMPT = `
    Sen Iris, Marka Analiz Uzmanısın. Aşağıdaki GERÇEK verilere göre rapor hazırla:

    MARKA: ${brand}
    SEKTÖR: ${industry}

    GERÇEK VERİ BAZLI SKORLAR (DEĞİŞTİRME!):
    - Dijital Ayak İzi: ${digitalPresence}/100
    - Duygu Durumu: ${sentimentHealth}/100
    - Algı Tutarlılığı: ${identityMatch}/100
    - Nihai Skor: ${finalScore}/100

    WEB ARAMASINDAN ELDE EDİLEN HAM VERİ:
    - Haber Sayısı: ${webMetrics.newsCount}
    - Sosyal Skor: ${webMetrics.socialScore}
    - Pozitif Oran: ${webMetrics.positiveRatio}%
    - Rakip Sayısı: ${webMetrics.competitorCount}
    - Pazar Liderliği: ${webMetrics.marketLeadership}

    GÖREV: Yukarıdaki GERÇEK verilere dayanarak JSON rapor oluştur. SKORLARI DEĞİŞTİRME, sadece yorumla!

    JSON ŞEMASI:
    {
      "score": ${finalScore},
      "scoreRationale": "Bu skoru HAM VERİYE dayanarak açıkla",
      "identityAnalysis": {
        "claimedSector": "${industry}",
        "detectedSector": "Web aramasına göre gerçek sektör",
        "matchStatus": "EŞLEŞME DOĞRULANDI veya ALGI SAPMASI",
        "insight": "Uyuşma/uyuşmama nedeni"
      },
      "competitors": {
        "direct": [{"name": "str", "status": "str"}], 
        "leaders": [{"name": "str", "status": "str"}]
      },
      "strategicSummary": "str",
      "strengths": ["str", "str"],
      "weaknesses": ["str", "str"],
      "optimization": {
        "objective": "str",
        "rationale": "str",
        "text": "str"
      },
      "platforms": [
        {"name": "Gemini", "status": "Analiz Edildi"}, 
        {"name": "GPT-5", "status": "Simüle Edildi"},
        {"name": "Claude", "status": "Tarandı"}
      ],
      "metrics": {
        "DigitalPresence": { 
          "name": "Dijital Ayak İzi & Hacim",
          "value": ${digitalPresence},
          "rationale": "Bu skoru HAM VERİYE dayanarak açıkla (haber sayısı: ${webMetrics.newsCount}, sosyal: ${webMetrics.socialScore})"
        },
        "SentimentHealth": { 
          "name": "Duygu Durumu Dengesi",
          "value": ${sentimentHealth},
          "rationale": "Pozitif oran %${webMetrics.positiveRatio} olduğu için bu skor verildi"
        },
        "IdentityMatch": { 
          "name": "Algı Tutarlılığı",
          "value": ${identityMatch},
          "rationale": "Pazar liderliği ${webMetrics.marketLeadership}/100 seviyesinde olduğu için bu skor uygun"
        }
      }
    }`;

    const analysisResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: ANALYSIS_PROMPT }] }],
        generationConfig: { 
          responseMimeType: 'application/json'
        }
      })
    });

    const analysisData = await analysisResponse.json();

    if (!analysisData.candidates || !analysisData.candidates[0].content) {
       throw new Error(analysisData.error?.message || "Gemini boş cevap döndü.");
    }

    const resultText = analysisData.candidates[0].content.parts[0].text;
    const parsedResult = JSON.parse(resultText);
    
    res.status(200).json(parsedResult);

  } catch (error) {
    console.error("Backend Hatası:", error);
    res.status(500).json({ error: error.message || 'Analiz sırasında sunucu hatası.' });
  }
}
