import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// ReceitaWS allows 3 req/min — enforce server-side
const cnpjLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: 'Limite de consultas CNPJ atingido. Aguarde 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(cnpjLimiter);

// Consulta CNPJ via ReceitaWS (gratuito, limite 3 req/min)
router.get('/:cnpj', async (req, res) => {
  try {
    const cnpj = req.params.cnpj.replace(/[^\d]/g, '');
    if (cnpj.length !== 14) {
      return res.status(400).json({ error: 'CNPJ inválido. Deve conter 14 dígitos.' });
    }

    const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({ error: 'Limite de consultas atingido. Aguarde 1 minuto e tente novamente.' });
      }
      return res.status(response.status).json({ error: 'Erro ao consultar CNPJ' });
    }

    const data = await response.json();

    if (data.status === 'ERROR') {
      return res.status(404).json({ error: data.message || 'CNPJ não encontrado' });
    }

    // Mapear para formato útil pro Prospector
    const result = {
      cnpj: data.cnpj,
      company_name: data.nome || data.fantasia || '',
      trade_name: data.fantasia || '',
      legal_name: data.nome || '',
      email: data.email || '',
      phone: data.telefone || '',
      address: [data.logradouro, data.numero, data.complemento].filter(Boolean).join(', '),
      neighborhood: data.bairro || '',
      city: data.municipio || '',
      state: data.uf || '',
      zip: data.cep || '',
      status: data.situacao || '',
      type: data.tipo || '',
      opening_date: data.abertura || '',
      main_activity: data.atividade_principal?.[0]?.text || '',
      main_activity_code: data.atividade_principal?.[0]?.code || '',
      secondary_activities: data.atividades_secundarias?.map(a => ({
        code: a.code,
        description: a.text,
      })) || [],
      share_capital: data.capital_social || '',
      partners: data.qsa?.map(p => ({
        name: p.nome,
        role: p.qual,
      })) || [],
      raw: data,
    };

    res.json(result);
  } catch (error) {
    console.error('Erro ao consultar CNPJ:', error);
    res.status(500).json({ error: 'Erro interno ao consultar CNPJ' });
  }
});

export default router;
