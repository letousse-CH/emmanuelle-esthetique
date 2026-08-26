import os
import sys
from pathlib import Path
from google import genai

# Dossiers et fichiers exclus
EXCLUDED_DIRS = {
    ".git", "node_modules", "venv", ".venv", "__pycache__",
    "dist", "build", ".gemini", ".next", ".cache", "scratch", ".idea", ".vscode"
}
CODE_EXTENSIONS = {".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".php", ".json"}
MAX_FILE_SIZE_KB = 40

def collect_code(target_dir: str):
    root = Path(target_dir).resolve()
    codebase = []
    
    for path in root.rglob("*"):
        if any(part in EXCLUDED_DIRS for part in path.parts):
            continue
        if not path.is_file() or path.suffix not in CODE_EXTENSIONS:
            continue
        if path.stat().st_size > MAX_FILE_SIZE_KB * 1024:
            continue
            
        try:
            content = path.read_text(encoding="utf-8", errors="ignore").strip()
            if content:
                rel = path.relative_to(root)
                codebase.append(f"\n--- FICHIER: {rel} ---\n{content}")
        except Exception:
            pass

    return "\n".join(codebase)

def main():
    target_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    print(f"🔍 Scan des fichiers dans : {target_dir}...")
    
    code = collect_code(target_dir)
    if not code.strip():
        print("❌ Aucun fichier de code éligible trouvé.")
        return

    print("🚀 Analyse en cours avec Gemini Flash (réponse en direct) :\n")
    print("=" * 60)

    client = genai.Client()
    
    prompt = f"""
Tu es un consortium d'experts en audit logiciel (Logique, UI/UX, Architecture, Performance).
Voici le code source de l'application :

{code}

Analyse le code et donne un retour direct, synthétique et sans détour :
1. Bugs critiques & incohérences (fonctions cassées, exceptions non gérées, variables manquantes).
2. Problèmes d'interface & rendu (ce qui bloque la fluidité ou l'affichage).
3. Plan de correction prioritaire avec extraits de code corrigés pour les problèmes majeurs.
"""

    chat = client.chats.create(
        model="gemini-3.6-flash",
        config={"temperature": 0.2}
    )

    response_stream = chat.send_message_stream(prompt)
    for chunk in response_stream:
        print(chunk.text, end="", flush=True)

    print("\n" + "=" * 60)
    print("✅ Audit terminé.")

if __name__ == "__main__":
    main()
