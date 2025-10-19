import fs from "fs";
import speech from "@google-cloud/speech";
import 'dotenv/config';

const client = new speech.SpeechClient();

async function quickstart() {
  const filename = "../cloud/voice_sample.wav"; // <-- corrige ici
  
  const file = fs.readFileSync(filename);
  const audioBytes = file.toString("base64");

  const request = {
    audio: { content: audioBytes },
    config: {
      encoding: "MP4", // correspond au conteneur M4A/AAC
      sampleRateHertz: 16000, 
      languageCode: "fr-FR",
      enableAutomaticPunctuation: true,
    },
  };

  try {
    const [response] = await client.recognize(request);
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join("\n");
    console.log("🗣️ Transcription : ", transcription || "(aucun texte détecté)");
  } catch (error) {
    console.error("❌ Erreur :", error);
  }
}

quickstart();