import fs from "fs";
import util from "util";
import speech from "@google-cloud/speech";
import textToSpeech from "@google-cloud/text-to-speech";

const speechClient = new speech.SpeechClient();
const ttsClient = new textToSpeech.TextToSpeechClient();

async function voiceRoundTrip() {
  console.log("🎤 [voice.start] Début de l'écoute...");

  // Étape 1 : lecture de ton audio d’entrée (wav test)
  const filename = "../cloud/voice_sample.wav";
  const file = fs.readFileSync(filename);
  const audioBytes = file.toString("base64");

  // Étape 2 : Transcription (STT)
  const sttRequest = {
    audio: { content: audioBytes },
    config: {
      encoding: "LINEAR16",
      sampleRateHertz: 16000,
      languageCode: "fr-FR",
      enableAutomaticPunctuation: true,
    },
  };

  const [sttResponse] = await speechClient.recognize(sttRequest);
  const transcription =
    sttResponse.results.map(r => r.alternatives[0].transcript).join("\n");

  console.log(`✅ [voice.final] Transcription : "${transcription}"`);

  // Étape 3 : réponse simulée d'Aura
  const auraReply = `Bien reçu, Emery. Tu as dit : ${transcription}`;

  console.log(`💬 [agent.reply] ${auraReply}`);

  // Étape 4 : Synthèse vocale (TTS)
  const ttsRequest = {
    input: { text: auraReply },
    voice: {
      languageCode: "fr-FR",
      name: "fr-FR-Wavenet-E", // voix MVP sprint 1
      ssmlGender: "FEMALE",
    },
    audioConfig: { audioEncoding: "MP3", speakingRate: 1.0, pitch: 0 },
  };

  const [ttsResponse] = await ttsClient.synthesizeSpeech(ttsRequest);
  const writeFile = util.promisify(fs.writeFile);
  await writeFile("aura_reply.mp3", ttsResponse.audioContent, "binary");

  console.log("🔊 [voice.play] Aura répond vocalement : aura_reply.mp3 généré !");
  console.log("✅ Sprint 1 bouclé – cycle Voix fonctionnel 🎯");
}

voiceRoundTrip().catch(err => console.error("❌ Erreur :", err));