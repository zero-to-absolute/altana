// Атомарные операции рецептов и корзины через PL/pgSQL RPC: снимок state уходит в Postgres как jsonb,
// функция заворачивает всю работу в одну транзакцию.

import { supabase } from '../shared/supabase.js';
import { getState } from './state.js';

// state конструктора в payload для jsonb-параметра RPC
function buildStatePayload(state) {
  return {
    recipeName: state.recipeName,
    genre: state.genre,
    blendFormat: state.blendFormat,
    totalBaseGrams: state.totalBaseGrams,
    bases: state.bases,
    ingredients: state.ingredients,
  };
}

// создаёт рецепт и добавляет его в корзину, возвращает id рецепта; бросает Error при ошибке RPC
export async function saveRecipeAndAddToCart() {
  const { data, error } = await supabase.rpc('create_recipe_and_add_to_cart', {
    state_json: buildStatePayload(getState()),
  });
  if (error) throw new Error(error.message);
  return data;
}

// удаляет позицию корзины (при редактировании из корзины старая строка уходит после сохранения новой смеси)
export async function deleteCartItem(cartItemId) {
  const { error } = await supabase.from('cart_items').delete().eq('id', cartItemId);
  if (error) throw new Error(error.message);
}

// перезаписывает рецепт пользователя из state через RPC update_recipe_and_replace_items (одна транзакция)
export async function updateExistingRecipe(explicitRecipeId) {
  const state = getState();
  const recipeId = explicitRecipeId || state.editRecipeId;
  if (!recipeId) throw new Error('Нет id рецепта для обновления');

  const { data, error } = await supabase.rpc('update_recipe_and_replace_items', {
    p_recipe_id: recipeId,
    state_json: buildStatePayload(state),
  });
  if (error) throw new Error(error.message);
  return data;
}
