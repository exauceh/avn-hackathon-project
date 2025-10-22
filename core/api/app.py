from flask import Flask, jsonify, request
from flask_cors import CORS  # ✅ permet les requêtes depuis l’extension Chrome
import os

app = Flask(__name__)
CORS(app)  # ✅ active le CORS globalement

# 🟢 Endpoint de test (ping)
@app.route("/")
def home():
    return jsonify({"message": "AVN backend opérationnel !"})

# 🧠 Nouveau : Endpoint de perception du DOM
@app.route("/perceive", methods=["POST"])
def perceive():
    data = request.get_json(force=True, silent=True) or {}
    print("📥 DOM reçu :", list(data.keys()))

    titles = data.get("titles", [])
    paragraphs = data.get("paragraphs", [])
    images = data.get("images", [])
    forms = data.get("forms", 0)

    summary = f"{len(titles)} titres, {len(paragraphs)} paragraphes, {len(images)} images, {forms} formulaires détectés."

    return jsonify({
        "message": "Page analysée avec succès",
        "summary": summary
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)

