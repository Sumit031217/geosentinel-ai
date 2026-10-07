import requests
import json

def generate_region_summary(region_name, date_t1, date_t2, stats_json):
    """
    Sends strict PostGIS JSON statistics to a local Ollama model to generate a natural language report.
    """
    prompt = f"""
    You are an expert geospatial intelligence analyst. Based ONLY on the following statistical data 
    extracted from satellite change detection models, write a 3-paragraph executive summary.
    
    Rules:
    1. Do NOT invent or hallucinate any numbers, locations, or events.
    2. Do NOT guess the human or political intent behind the changes.
    3. Focus strictly on physical changes to the terrain, infrastructure, and agriculture.
    4. State the model's confidence score clearly.
    
    Context: Region: {region_name} | Period: {date_t1} to {date_t2}
    
    Data:
    {json.dumps(stats_json, indent=2)}
    """
    
    # Call local Ollama instance (default port 11434)
    response = requests.post('http://localhost:11434/api/generate', json={
        "model": "mistral",
        "prompt": prompt,
        "stream": False,
        "temperature": 0.1 # Very low temperature to prevent hallucination
    })
    
    return response.json()['response']