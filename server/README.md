# Google PageSpeed API Key

Para evitar limites diários da API pública do Google PageSpeed Insights, configure uma chave de API própria:

1. Crie um projeto no [Google Cloud Console](https://console.cloud.google.com/).
2. Ative a API PageSpeed Insights.
3. Gere uma chave de API.
4. No arquivo `.env` do backend, adicione:

```
PAGESPEED_API_KEY=sua_chave_aqui
```

Se não configurar, será usada a cota pública (limitada e sujeita a bloqueio/quota exceeded).
