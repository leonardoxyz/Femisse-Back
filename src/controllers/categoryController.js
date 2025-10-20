import { createClient } from '@supabase/supabase-js';
import {
  toPublicCategoryList,
  toAdminCategory,
  validateCategoryInput,
  sanitizeCategoryInput,
} from '../dto/categoryDTO.js';
import { cacheGet, cacheSet, cacheDelete } from '../services/cacheService.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const CATEGORIES_CACHE_KEY = 'cache:categories:all';
const CATEGORIES_CACHE_TTL = 300; // 5 minutos

export const getAllCategories = async (req, res) => {
  try {
    const cached = await cacheGet(CATEGORIES_CACHE_KEY);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    const { data = [], error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) throw error;
    const response = toPublicCategoryList(data);
    await cacheSet(CATEGORIES_CACHE_KEY, response, CATEGORIES_CACHE_TTL);
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar categorias',
      details: error.message,
    });
  }
};

export const updateCategory = async (req, res) => {
  const { id } = req.params;
  const rawInput = req.validatedBody ?? req.body;
  const { isValid, errors } = validateCategoryInput(rawInput);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'ID da categoria é obrigatório',
    });
  }

  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos para atualizar categoria',
      errors,
    });
  }

  const { name, image } = sanitizeCategoryInput(rawInput);

  try {
    const { data, error } = await supabase
      .from('categories')
      .update({ name, image })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await cacheDelete(CATEGORIES_CACHE_KEY);

    return res.json({
      success: true,
      data: toAdminCategory(data),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar categoria',
      details: error.message,
    });
  }
};

export const deleteCategory = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'ID da categoria é obrigatório',
    });
  }

  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await cacheDelete(CATEGORIES_CACHE_KEY);

    return res.json({
      success: true,
      message: 'Categoria removida com sucesso',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao remover categoria',
      details: error.message,
    });
  }
};

export const createCategory = async (req, res) => {
  const rawInput = req.validatedBody ?? req.body;
  const { isValid, errors } = validateCategoryInput(rawInput);

  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos para criar categoria',
      errors,
    });
  }

  const { name, image } = sanitizeCategoryInput(rawInput);
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert([{ name, image }])
      .select()
      .single();
    
    if (error) throw error;
    await cacheDelete(CATEGORIES_CACHE_KEY);
    res.status(201).json({
      success: true,
      data: toAdminCategory(data),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao criar categoria',
      details: error.message,
    });
  }
};
