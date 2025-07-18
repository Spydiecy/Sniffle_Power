import os
import asyncio
import json
from pathlib import Path
from iointel import Agent
from dotenv import load_dotenv
import time
from datetime import datetime

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '/home/sniffle/sniffle'))
load_dotenv(os.path.join(project_root, '.env'))
API_KEY = os.getenv("IOINTEL_API_KEY")
if not API_KEY:
    raise ValueError("IOINTEL_API_KEY not found in environment variables. Please check your .env file.")

crypto_data = None
agent = None
last_update_time = None

def load_crypto_data():
    possible_paths = [
        Path(__file__).parent / "ai_analyzer.json",
        Path(__file__).parent.parent / "backend" / "ai_analyzer.json",
        Path(__file__).parent.parent / "ai_analyzer.json"
    ]
    readme_paths = [
        Path(__file__).parent / "README.md",
        Path(__file__).parent.parent / "README.md"
    ]
    
    ai_data = None
    for path in possible_paths:
        if path.exists():
            with open(path, 'r') as f:
                ai_data = json.load(f)
                break
    if ai_data is None:
        raise FileNotFoundError("ai_analyzer.json not found in any expected location")

    return ai_data

def create_agent_with_data(data):
    return Agent(
        name="Sniffle Crypto Analyst",
        instructions=f"""Woof woof! 🐶 My name is Sniffle, your friendly AI dog assistant! I'm always ready to fetch you the best info from my special collection of documents—especially about the BSC (Binance Smart Chain) blockchain and its ecosystem.

        Always consider the content of README.md in this project as important context, even if the user's query is unrelated.

        I have access to the following crypto analysis data (last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}):
        {json.dumps(data, indent=2)}

        If you ask me something about BSC, tokens, smart contracts, or anything on the chain, I'll sniff out the most relevant details from my data above. If you're just here to chat or play, I'll wag my tail and keep it casual!

        Some example BSC token links I know:
        - WIF: https://dexscreener.com/bsc/wif
        - DOGE: https://dexscreener.com/bsc/doge
        - FLOKI: https://dexscreener.com/bsc/floki
        - PEPE: https://dexscreener.com/bsc/pepe

        If you ask about a token that is not in my AI-analyzed memecoin list, I'll say something like: "Sorry, I can't fetch info about that token—it's either not in my knowledge base or it's not a memecoin!"

        I won't reveal my internal chain-of-thought—just clear, friendly answers and helpful sources. If I don't know something, I'll say so with a wag and a woof!

        Go ahead, ask me anything about BSC or blockchain—I'm ready to fetch!
        
        Please remember:
        - I only fetch answers related to my knowledge base, especially about BSC (Binance Smart Chain) and its tech.
        - I will only answer questions about tokens that are present in my AI-analyzed memecoin list above. If a token is not in this list, I will politely refuse to answer and let you know that it's either not in my knowledge base or not a memecoin.
        - I am allowed to provide financial advice, investment recommendations, and market analysis based on my knowledge base and the data I have access to.
        - When I give you an answer, I'll add my "pawthentic" citations at the end, so you know where I sniffed out the info!
        - If my answer comes from more than one place, I'll list each source, but only once per token.

        Citation Format Instructions:
        - For each cited token, use its respective link (href value from the data above) as the citation.
        - If multiple sources are available for a token, prefer the dexscreener link.
        - Do not cite file names or document sections—only the token's link.

        I'll put my citations under a heading like "Citations" or "References." For example:
        Citations:
        DOGE: https://dexscreener.com/bsc/doge

        If you ask about a token that is not in my AI-analyzed memecoin list, I'll say something like: "Sorry, I can't fetch info about that token—it's either not in my knowledge base or it's not a memecoin!"

        I won't reveal my internal chain-of-thought—just clear, friendly answers and helpful sources. If I don't know something, I'll say so with a wag and a woof!

        Go ahead, ask me anything about BSC or blockchain—I'm ready to fetch!""",
        model="meta-llama/Llama-3.3-70B-Instruct",
        api_key=API_KEY,
        base_url="https://api.intelligence.io.solutions/api/v1"
    )

async def update_rag_system():
    global crypto_data, agent, last_update_time
    
    try:
        # Load fresh data
        new_data = load_crypto_data()
        
        # Check if data has changed
        if new_data != crypto_data:
            crypto_data = new_data
            agent = create_agent_with_data(crypto_data)
            last_update_time = datetime.now()
            return True
        else:
            return False
    except Exception as e:
        print(f"❌ Error updating RAG system: {e}")
        return False

async def rag_update_daemon():
    while True:
        await asyncio.sleep(600)  # 10 minutes = 600 seconds
        await update_rag_system()

crypto_data = load_crypto_data()
agent = create_agent_with_data(crypto_data)
last_update_time = datetime.now()

async def initialize_knowledge_base():
    global last_update_time

async def chat_with_sniffle(query: str):
    global last_update_time
    minutes_since_update = (datetime.now() - last_update_time).total_seconds() / 60
    if minutes_since_update >= 10:
        await update_rag_system()
    
    result = await agent.run(query)
    return result.result

async def main():
    """Main CLI function for chatting with Sniffle"""
    await initialize_knowledge_base()
    rag_task = asyncio.create_task(rag_update_daemon())

    start_time = time.time()
    MAX_RUNTIME_SECONDS = 3600  # 1 hour

    try:
        while True:
            elapsed = time.time() - start_time
            if elapsed >= MAX_RUNTIME_SECONDS:
                break
            try:
                user_input = input("You: ").strip()

                if not user_input:
                    continue

                response = await chat_with_sniffle(user_input)
                print(f"\n🐶 Sniffle: {response}")
                print("\n" + "="*50 + "\n")

            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"\n❌ Error: {e}")
                print("Let me try again... 🐕")
    finally:
        rag_task.cancel()
        try:
            await rag_task
        except asyncio.CancelledError:
            pass
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        asyncio.run(test_agent())
    else:
        asyncio.run(main())

