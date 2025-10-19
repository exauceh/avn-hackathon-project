import textToSpeech from "@google-cloud/text-to-speech";
import fs from "fs";
import util from "util";

const client = new textToSpeech.TextToSpeechClient();

async function synthesizeWavenetE() {
  // Texte à vocaliser : tu peux le changer pour ton test
  const text = "Bonjour Emery ! Ici Aura, version francophone avec une voix plus naturelle grâce à Wavenet E.";

  const request = {
    input: { text },
    voice: {                                     
      languageCode: "fr-FR",
      name: "fr-FR-Wavenet-E",       // 👈 la voix que tu veux tester
      ssmlGender: "FEMALE"
    },
    audioConfig: {
      audioEncoding: "MP3",          // possible aussi: "LINEAR16" pour WAV
      speakingRate: 1.0,             // vitesse de parole
      pitch: 0.0                     // ajuster la tonalité (+/-)
    }
  };

  try {
    const [response] = await client.synthesizeSpeech(request);
    const writeFile = util.promisify(fs.writeFile);
    await writeFile("aura_wavenet_e.mp3", response.audioContent, "binary");
    console.log("✅ Fichier 'aura_wavenet_e.mp3' créé avec succès !");
    console.log("👉 Essaie d'écouter la différence : la voix est plus chaleureuse et fluide.");
  } catch (error) {
    console.error("❌ Erreur lors de la synthèse :", error);
  }
}

synthesizeWavenetE();