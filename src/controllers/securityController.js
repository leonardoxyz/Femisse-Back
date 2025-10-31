import { checkSafeBrowsingStatus } from '../services/safeBrowsingService.js';

export async function getSafeBrowsingStatus(req, res) {
  try {
    const { urls } = req.body || {};
    const queryUrl = req.query?.url;

    let entries = [];

    if (Array.isArray(urls) && urls.length > 0) {
      entries = urls;
    } else if (Array.isArray(queryUrl) && queryUrl.length > 0) {
      entries = queryUrl;
    } else if (typeof queryUrl === 'string' && queryUrl.trim().length > 0) {
      entries = [queryUrl];
    } else {
      entries = ['https://femisse.com.br/'];
    }

    const result = await checkSafeBrowsingStatus(entries);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao consultar status de segurança',
      details: error?.message,
    });
  }
}

export default {
  getSafeBrowsingStatus,
};
