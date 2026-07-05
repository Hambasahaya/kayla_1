const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

// Standard mapping helpers
const emotionMapping = {
  sadness: 'Sedih',
  anger: 'Marah',
  fear: 'Takut',
  joy: 'Senang',
  love: 'Cinta',
  neutral: 'Netral',
  surprise: 'Terkejut',
  disgust: 'Jijik'
};

const sentimentMapping = {
  positive: 'Positif',
  negative: 'Negatif',
  neutral: 'Netral',
  LABEL_0: 'Negatif',
  LABEL_1: 'Netral',
  LABEL_2: 'Positif'
};

// Local Simulator Fallback (High-fidelity mockup)
function runLocalSimulator(text) {
  const lowercase = text.toLowerCase();
  
  // 1. Emotion Simulator
  let emotion = 'Netral';
  let emotionScore = 0.8;
  
  if (lowercase.match(/(bunuh diri|mati|akhiri hidup|menyerah|menangis|nangis|sedih|kecewa|sakit hati|hancur|kesepian|sepi|capek|lelah|berat)/)) {
    emotion = 'Sedih';
    emotionScore = 0.85;
  } else if (lowercase.match(/(marah|kesal|benci|kesel|jengkel|emosi|murka|brengsek|anjing|sialan)/)) {
    emotion = 'Marah';
    emotionScore = 0.9;
  } else if (lowercase.match(/(takut|cemas|khawatir|panik|ngeri|gemetar|ancam|diancam|dibully|bully)/)) {
    emotion = 'Takut';
    emotionScore = 0.88;
  } else if (lowercase.match(/(cinta|sayang|suka|peduli|kasih|kangen|rindu)/)) {
    emotion = 'Cinta';
    emotionScore = 0.82;
  } else if (lowercase.match(/(senang|bahagia|gembira|ceria|untung|bersyukur|alhamdulillah|mantap|keren)/)) {
    emotion = 'Senang';
    emotionScore = 0.92;
  }

  // 2. Sentiment Simulator
  let sentiment = 'Netral';
  let sentimentScore = 0.75;
  
  if (lowercase.match(/(jelek|buruk|gagal|sakit|benci|marah|sedih|dibully|susah|sulit|kecewa|lelah|mati|menyerah|panik|takut|cemas|hancur)/)) {
    sentiment = 'Negatif';
    sentimentScore = 0.85;
  } else if (lowercase.match(/(baik|bagus|senang|bahagia|cinta|sayang|hebat|keren|mantap|bisa|sukses|berhasil|aman|tenang|bersyukur)/)) {
    sentiment = 'Positif';
    sentimentScore = 0.88;
  }

  // 3. Risk Evaluation Simulator
  let riskScore = 'Low';
  let riskReason = 'Percakapan umum atau sapaan biasa, tidak terdeteksi indikasi krisis.';
  let riskFlags = [];
  let empatheticResponse = '';
  let actionPlan = [];

  // Crisis detection
  if (lowercase.match(/(bunuh diri|akhiri hidup|sayat|potong urat nadi|gantung diri|pengen mati|lompat dari jembatan|overdosis|menyerah hidup)/)) {
    riskScore = 'Crisis';
    riskReason = 'Terdeteksi indikasi menyakiti diri sendiri (self-harm) atau pikiran bunuh diri yang aktif.';
    riskFlags = ['Self-Harm', 'Depression'];
    empatheticResponse = 'Aku dengar kamu sedang melewati masa yang sangat berat saat ini. Tolong ketahuilah kalau kamu tidak sendirian. Sebagai Guru BK-mu, Rumi ada di sini untuk menemani dan mendengarkanmu. Bisakah kamu cerita lebih lanjut apa yang membuatmu merasa sangat berat hari ini? Dan apakah saat ini ada orang terdekat yang sedang bersamamu?';
    actionPlan = [
      'Segera lakukan intervensi krisis: hubungi siswa atau kunjungi kelasnya.',
      'Hubungi orang tua siswa untuk menginfokan situasi darurat ini dengan hati-hati.',
      'Rujuk siswa ke psikolog profesional atau layanan kesehatan mental darurat.',
      'Pastikan siswa berada di bawah pengawasan orang dewasa yang aman.'
    ];
  } 
  // High risk detection
  else if (lowercase.match(/(dibully|diancam|dipukuli|di-bully|pemerasan|dipalak|pelecehan|dilecehkan)/)) {
    riskScore = 'High';
    riskReason = 'Terdeteksi indikasi perundungan (bullying) aktif atau kekerasan fisik/verbal.';
    riskFlags = ['Bullying', 'Social Issues'];
    empatheticResponse = 'Aku sangat sedih mendengar kamu harus mengalami hal itu. Tidak ada seorang pun yang pantas diperlakukan kasar atau diancam. Kamu sangat berani karena sudah mau menceritakan ini ke Rumi sebagai Guru BK-mu. Boleh ceritakan lebih banyak, siapa saja yang membuatmu merasa tidak aman di sekolah? Aku di sini siap menemanimu.';
    actionPlan = [
      'Panggil siswa secara privat ke ruang BK untuk mendiskusikan kronologi kejadian perundungan.',
      'Identifikasi pelaku perundungan dan kumpulkan bukti pendukung.',
      'Berikan perlindungan psikologis dan fisik bagi siswa di lingkungan sekolah.',
      'Lakukan mediasi terstruktur dan komunikasikan dengan wali kelas serta kepala sekolah.'
    ];
  }
  // Medium risk detection
  else if (lowercase.match(/(stres|stress|depresi|tekanan|ortu bertengkar|broken home|nilai jelek|gagal|tidak lulus|susah belajar|kesepian|sendirian|minder)/)) {
    riskScore = 'Medium';
    riskReason = 'Siswa menunjukkan tanda kecemasan akademis, konflik keluarga, atau kesepian tingkat menengah.';
    riskFlags = lowercase.match(/(ortu|rumah|keluarga)/) ? ['Family Issues'] : lowercase.match(/(nilai|belajar|lulus|sekolah)/) ? ['Academic'] : ['Depression'];
    
    if (riskFlags.includes('Family Issues')) {
      empatheticResponse = 'Rumah seharusnya menjadi tempat yang paling aman dan tenang buat kamu. Wajar sekali kalau kamu merasa sedih atau tertekan ketika ada masalah di rumah. Sebagai Guru BK, aku ada di sini untuk mendengarkanmu tanpa menghakimi. Mau ceritakan lebih lanjut apa yang sedang terjadi di rumah saat ini?';
      actionPlan = [
        'Jadwalkan konseling individu berkala untuk membantu siswa mengelola stres keluarganya.',
        'Jika diperlukan, komunikasikan dengan orang tua untuk memberikan pemahaman mengenai kondisi psikologis siswa.',
        'Ajarkan teknik koping stres (seperti jurnaling atau mindfulness).'
      ];
    } else if (riskFlags.includes('Academic')) {
      empatheticResponse = 'Tekanan soal nilai dan pelajaran sekolah memang seringkali bikin kepikiran dan bikin stres ya. Ingat ya, nilaimu tidak menentukan seluruh harga dirimu atau masa depanmu. Sebagai Guru BK, aku ingin membantumu melewati ini. Bagian mana atau pelajaran apa yang paling membuatmu merasa terbebani saat ini?';
      actionPlan = [
        'Adakan sesi bimbingan belajar tambahan atau bantu siswa membuat jadwal belajar baru.',
        'Koordinasikan dengan guru mata pelajaran terkait untuk memberikan toleransi atau remedial.',
        'Bantu siswa membangun rasa percaya diri kembali.'
      ];
    } else {
      empatheticResponse = 'Merasa kesepian atau tertekan itu memang tidak menyenangkan dan melelahkan sekali. Terima kasih ya sudah mau terbuka dan bercerita kepada Guru BK-mu. Apa yang biasanya kamu lakukan untuk membuat dirimu merasa lebih baik saat situasi seperti ini? Ceritakan saja pelan-pelan, ya.';
      actionPlan = [
        'Lakukan pemantauan emosi siswa secara berkala melalui sesi konseling kasual.',
        'Ajak siswa untuk berpartisipasi aktif dalam kegiatan sosial sekolah atau ekstrakurikuler.',
        'Bantu siswa mengenali jejaring pendukungnya (teman dekat, guru favorit).'
      ];
    }
  } 
  // Low risk (General / Greetings)
  else {
    // Check if the user is sharing a specific emotional problem
    if (lowercase.match(/(putus|diputus|selingkuh|pacar|mantan|filaa|adit)/)) {
      empatheticResponse = 'Ya ampun, aku paham banget perasaanmu... Sakit dan kecewa sekali ya rasanya diputusin atau diselingkuhin begitu. Kamu berhak banget untuk merasa sedih atau marah saat ini. Sebagai Guru BK, aku siap mendengarkan curhatanmu. Bagaimana keadaanmu sekarang? Mau cerita lebih detail tentang apa yang terjadi?';
      riskScore = 'Low';
      riskReason = 'Siswa bercerita tentang masalah asmara (putus cinta) tanpa adanya indikasi melukai diri.';
      riskFlags = ['Social Issues'];
      actionPlan = [
        'Siswa mengalami kesedihan akibat putus cinta / masalah hubungan sosial remaja.',
        'Berikan validasi atas perasaan kecewa siswa.',
        'Bantu siswa memfokuskan kembali energinya pada aktivitas akademik dan pengembangan diri.'
      ];
    } else if (lowercase.match(/(sedih|kecewa|menangis|nangis|sepi|kesepian|hancur)/)) {
      empatheticResponse = 'Aku ngerti banget, rasa sedih atau sepi itu memang berat sekali untuk dijalani sendirian. Tidak apa-apa kalau kamu merasa lelah atau ingin menangis saat ini, itu perasaan yang sangat wajar. Sebagai Guru BK-mu, aku siap mendengarkan. Apa yang sebenarnya sedang mengganjal di pikiranmu saat ini? Cerita pelan-pelan ke aku, ya.';
      riskScore = 'Low';
      riskReason = 'Siswa menyampaikan perasaan sedih atau kesepian umum.';
      riskFlags = ['Depression'];
      actionPlan = [
        'Siswa menunjukkan perasaan sedih atau kesepian.',
        'Pantau kondisi suasana hati (mood) siswa secara berkala.',
        'Bantu siswa mengidentifikasi aktivitas positif yang bisa dilakukan untuk meredakan kesedihan.'
      ];
    } else if (lowercase.match(/(marah|kesal|benci|kesel|jengkel|emosi|jahat)/)) {
      empatheticResponse = 'Wajar sekali kalau kamu merasa kesal atau marah. Ketika ada hal yang terasa tidak adil atau mengganggu, emosi kita pasti akan terpancing. Sebagai Guru BK, aku ingin mendengarkan keluh kesahmu. Siapa atau situasi apa yang membuatmu sangat jengkel hari ini? Silakan ceritakan semuanya ke aku.';
      riskScore = 'Low';
      riskReason = 'Siswa mengekspresikan kekesalan atau kemarahan umum.';
      riskFlags = ['Social Issues'];
      actionPlan = [
        'Siswa menunjukkan emosi kemarahan atau kekesalan terhadap lingkungan.',
        'Ajarkan metode penyaluran emosi kemarahan secara sehat (seperti deep breathing atau jurnaling).',
        'Bantu siswa melihat permasalahan secara objektif.'
      ];
    } else if (lowercase.match(/(halo|hai|pagi|siang|sore|malam|permisi|assalamualaikum|rumi|p)/)) {
      empatheticResponse = 'Halo! Aku Rumi, Guru BK virtualmu di sekolah. Aku siap menjadi tempat cerita yang aman tentang sekolah, pertemanan, keluarga, atau apa pun yang sedang kamu rasakan saat ini. Apa ada yang ingin kamu ceritakan atau bagikan hari ini?';
      actionPlan = [
        'Siswa menyapa asisten konseling.',
        'Tanggapi dengan ramah untuk membangun kenyamanan komunikasi (rapport).',
        'Dorong siswa untuk terbuka jika ada hal yang ingin dikonsultasikan.'
      ];
    } else {
      empatheticResponse = 'Aku ada di sini sebagai Guru BK-mu untuk mendengarkan cerita kamu. Sepertinya saat ini ada banyak hal yang sedang berkecamuk di pikiranmu, ya? Kalau kamu merasa nyaman, bolehkah ceritakan pelan-pelan ke aku agar perasaanmu bisa terasa lebih lega?';
      actionPlan = [
        'Siswa memulai cerita secara umum.',
        'Gunakan teknik active listening untuk menelusuri detail masalah siswa.',
        'Bantu siswa merasa didengarkan dan didukung sepenuhnya.'
      ];
    }
  }

  return {
    emotion,
    emotionScore,
    sentiment,
    sentimentScore,
    riskScore,
    riskReason,
    riskFlags,
    empatheticResponse,
    actionPlan,
    source: 'Local Simulator'
  };
}

// Main processing logic
async function processText(text, history = [], userKeys = {}) {
  // If history was omitted and userKeys was passed as second argument (backwards compatibility)
  if (!Array.isArray(history) && typeof history === 'object') {
    userKeys = history;
    history = [];
  }

  // Read keys from parameters or fallback to env variables
  const geminiApiKey = userKeys.geminiApiKey || process.env.GEMINI_API_KEY;
  const hfToken = userKeys.hfToken || process.env.HF_TOKEN;

  let emotion = null;
  let emotionScore = null;
  let sentiment = null;
  let sentimentScore = null;
  let hfSuccess = false;

  // Step 1 & 2: Try to call Hugging Face for IndoBERT if token is available
  if (hfToken) {
    try {
      // 1. IndoBERT Emotion
      const hfEmotionResponse = await axios.post(
        'https://api-inference.huggingface.co/models/thoriqfy/indobert-emotion-classification',
        { inputs: text },
        { headers: { Authorization: `Bearer ${hfToken}` }, timeout: 5000 }
      );
      
      if (Array.isArray(hfEmotionResponse.data) && Array.isArray(hfEmotionResponse.data[0])) {
        // Sort emotions by score descending
        const results = [...hfEmotionResponse.data[0]].sort((a, b) => b.score - a.score);
        if (results[0]) {
          const rawLabel = results[0].label;
          emotion = emotionMapping[rawLabel.toLowerCase()] || rawLabel;
          emotionScore = parseFloat(results[0].score.toFixed(4));
        }
      }

      // 2. IndoBERT Sentiment
      const hfSentimentResponse = await axios.post(
        'https://api-inference.huggingface.co/models/mdhugol/indonesia-bert-sentiment-classification',
        { inputs: text },
        { headers: { Authorization: `Bearer ${hfToken}` }, timeout: 5000 }
      );

      if (Array.isArray(hfSentimentResponse.data) && Array.isArray(hfSentimentResponse.data[0])) {
        const results = [...hfSentimentResponse.data[0]].sort((a, b) => b.score - a.score);
        if (results[0]) {
          const rawLabel = results[0].label;
          sentiment = sentimentMapping[rawLabel] || rawLabel;
          sentimentScore = parseFloat(results[0].score.toFixed(4));
        }
      }

      if (emotion && sentiment) {
        hfSuccess = true;
      }
    } catch (err) {
      console.warn('Hugging Face API call failed or timed out. Falling back to Gemini or Simulator.', err.message);
    }
  }

  // Step 3: Call LLM (Gemini) for Risk analysis and Empathetic response
  if (geminiApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      
      const systemInstruction = `
You are an expert Indonesian school guidance counselor (Guru Bimbingan Konseling / Guru BK). Your name is "Rumi", a virtual school counselor helper who is warm, empathetic, supportive, and acts as a trusted mentor and listener for the student.
Analyze the student's text and return a JSON object.

You will receive the student's latest message and a history of previous messages in the chat session for context. Respond to the student in a way that directly addresses the narrative flow of their ongoing conversation/story.

The return schema MUST be JSON containing exactly these fields:
1. "emotion": Predict the student's primary emotion from: ["Sedih", "Marah", "Takut", "Senang", "Cinta", "Netral"].
2. "sentiment": Predict the sentiment from: ["Positif", "Negatif", "Netral"].
3. "riskScore": Evaluate the risk level of the student's psychological and physical safety: Choose exactly one from ["Low", "Medium", "High", "Crisis"].
   - "Crisis": Active suicidal thoughts, self-harm, severe domestic violence/sexual abuse, immediate threat to life.
   - "High": Active bullying, severe depression, threats of violence, self-neglect.
   - "Medium": Academic stress, friendship drama, mild anxiety, isolation, home conflict.
   - "Low": Greetings, general chat, positive updates, normal academic questions.
4. "riskReason": A short explanation in Indonesian of why this risk score was assigned.
5. "riskFlags": Array of strings indicating the problem areas. Select any that apply from: ["Self-Harm", "Bullying", "Academic", "Family Issues", "Social Issues", "Depression"].
6. "empatheticResponse": A comforting, warm, supportive, and highly natural response written in Indonesian, acting as a school guidance counselor (Guru BK). You should respond to the student's chat nicely, show that you listen and care deeply about their venting (curhat), and validate their feelings. You must sound like an empathetic school counselor who is close and comfortable for students to talk to, not a sterile, formal AI ("AI banget"). Use friendly, natural everyday Indonesian (using comfortable pronouns like "aku" and "kamu", and particles like "ya", "kok", "sih", "deh" to make it feel close, caring, and warm). After giving a comforting and validating response, you MUST ask a good, relevant, open-ended follow-up question (pertanyaan balik yang baik) to show active listening and help the student open up more or explore their feelings further. Do not repeat greeting introductions if you have already introduced yourself.
7. "actionPlan": An array of actionable steps written in Indonesian for the human Guidance Counselor (Guru BK) to handle this student's case. Provide specific counseling advice.

IMPORTANT: Respond ONLY with a clean JSON string. Do not include markdown wraps like \`\`\`json.
`;

      const historyContext = Array.isArray(history) && history.length > 0
        ? "Riwayat percakapan sebelumnya untuk konteks:\n" + history.filter(h => h.sender !== 'system').map(h => `${h.sender === 'student' ? 'Siswa' : 'Rumi/Guru BK'}: ${h.text}`).join('\n') + "\n"
        : "";

      const userPrompt = `
${historyContext}
Menganalisis pesan terbaru siswa: "${text}"
${hfSuccess ? `IndoBERT Emotion Model output: ${emotion} (Score: ${emotionScore}).\nIndoBERT Sentiment Model output: ${sentiment} (Score: ${sentimentScore}).` : 'IndoBERT model pipeline was skipped; please perform emotion/sentiment prediction for the latest message.'}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: 'application/json'
        }
      });

      const rawJson = response.text.trim();
      const parsed = JSON.parse(rawJson);

      return {
        emotion: hfSuccess ? emotion : (parsed.emotion || 'Netral'),
        emotionScore: hfSuccess ? emotionScore : 0.95,
        sentiment: hfSuccess ? sentiment : (parsed.sentiment || 'Netral'),
        sentimentScore: hfSuccess ? sentimentScore : 0.95,
        riskScore: parsed.riskScore || 'Low',
        riskReason: parsed.riskReason || 'Tidak ada detail risiko khusus.',
        riskFlags: parsed.riskFlags || [],
        empatheticResponse: parsed.empatheticResponse || 'Halo, ada yang bisa aku bantu?',
        actionPlan: parsed.actionPlan || ['Pantau kondisi siswa secara berkala.'],
        source: hfSuccess ? 'HuggingFace + Gemini API' : 'Gemini API'
      };
    } catch (err) {
      console.warn('Gemini API call failed. Falling back to local simulator.', err.message);
    }
  }

  // If HF and Gemini both fail or keys aren't provided, return simulator output
  const simulatorResult = runLocalSimulator(text);
  
  // If Hugging Face succeeded but Gemini failed, override the simulator emotion/sentiment with the real HF values
  if (hfSuccess) {
    simulatorResult.emotion = emotion;
    simulatorResult.emotionScore = emotionScore;
    simulatorResult.sentiment = sentiment;
    simulatorResult.sentimentScore = sentimentScore;
    simulatorResult.source = 'HuggingFace + Local LLM Simulator';
  }

  return simulatorResult;
}

module.exports = {
  processText,
  runLocalSimulator
};
