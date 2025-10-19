import textToSpeech from "@google-cloud/text-to-speech";
import fs from "fs";
import util from "util";

// Initialise le client avec tes identifiants GCP
const client = new textToSpeech.TextToSpeechClient();

async function synthesizeSpeech() {
  const text = "Bonjour Emery, je suis Aura. Félicitations, tu as activé la voix de ton agent !";

  const request = {
    input: { text },
    voice: { languageCode: "fr-FR", ssmlGender: "FEMALE" },
    audioConfig: { audioEncoding: "MP3" },
  };

  const [response] = await client.synthesizeSpeech(request);

  // Sauvegarde la sortie audio dans un fichier
  const writeFile = util.promisify(fs.writeFile);
  await writeFile("voice_output.mp3", response.audioContent, "binary");
  console.log("🪄 Fichier voice_output.mp3 créé avec succès !");
}

synthesizeSpeech();