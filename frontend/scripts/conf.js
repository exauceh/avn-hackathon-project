// ⚙️ Configuration API
const API_CONFIG = {
  LOCAL: 'http://127.0.0.1:8080',
  PRODUCTION: 'https://api-gateway-769385086849.europe-west9.run.app'
};

// 🔧 Changez ici : 'LOCAL' ou 'PRODUCTION'
const ENVIRONMENT = 'PRODUCTION';
//
// URL active basée sur l'environnement
const API_URL = API_CONFIG[ENVIRONMENT];

console.log(`Environnement: ${ENVIRONMENT}`);
console.log(`API URL: ${API_URL}`);