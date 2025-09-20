import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export async function getAllProducts(req, res) {
  const { categoria_id, search } = req.query;
  let query = supabase.from('products').select('*');
  if (categoria_id) {
    query = query.eq('categoria_id', categoria_id);
  }
  if (search && search.trim() !== "") {
    // Busca case-insensitive por nome ou descrição
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }
  const { data: products, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  
  // Para cada produto, buscar as URLs das imagens se houver image_ids
  const productsWithImages = await Promise.all(
    products.map(async (product) => {
      let images = [];
      if (product.image_ids && product.image_ids.length > 0) {
        const { data: imageData, error: imageError } = await supabase
          .from('images')
          .select('image_url')
          .in('id', product.image_ids);
          
        if (!imageError && imageData) {
          images = imageData.map(img => img.image_url);
        }
      }
      return { ...product, images };
    })
  );
  
  res.json(productsWithImages);
}

export async function getProductById(req, res) {
  const { id } = req.params;
  
  // Buscar o produto
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();
    
  if (productError) return res.status(500).json({ error: productError.message });
  
  // Se o produto tem image_ids, buscar as URLs das imagens
  let images = [];
  if (product.image_ids && product.image_ids.length > 0) {
    const { data: imageData, error: imageError } = await supabase
      .from('images')
      .select('image_url')
      .in('id', product.image_ids);
      
    if (!imageError && imageData) {
      images = imageData.map(img => img.image_url);
    }
  }
  
  // Retornar o produto com as URLs das imagens
  res.json({ ...product, images });
}

export async function createProduct(req, res) {
  const {
    name,
    description,
    price,
    original_price,
    image,
    images,
    badge,
    badge_variant,
    sizes,
    colors,
    in_stock
  } = req.body;

  // Validação básica
  if (!name || !price || !image) {
    return res.status(400).json({ error: 'Campos obrigatórios: name, price, image' });
  }

  const { data, error } = await supabase
    .from('products')
    .insert([
      {
        name,
        description,
        price,
        original_price,
        image,
        images,
        badge,
        badge_variant,
        sizes,
        colors,
        in_stock
      }
    ])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
}

export async function updateProduct(req, res) {
  const { id } = req.params;
  const fields = req.body;
  if (!id) return res.status(400).json({ error: 'ID é obrigatório' });

  const { data, error } = await supabase
    .from('products')
    .update(fields)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function deleteProduct(req, res) {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'ID é obrigatório' });

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
}
