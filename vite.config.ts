import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/altana/',
  plugins: [tailwindcss()],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        catalog: resolve(__dirname, 'src/pages/catalog.html'),
        login: resolve(__dirname, 'src/pages/login.html'),
        register: resolve(__dirname, 'src/pages/register.html'),
        profile: resolve(__dirname, 'src/pages/profile.html'),
        about: resolve(__dirname, 'src/pages/about.html'),
        orders: resolve(__dirname, 'src/pages/orders.html'),
        favorites: resolve(__dirname, 'src/pages/favorites.html'),
        savedRecipes: resolve(__dirname, 'src/pages/saved-recipes.html'),
        cart: resolve(__dirname, 'src/pages/cart.html'),
        checkout: resolve(__dirname, 'src/pages/checkout.html'),
        constructor: resolve(__dirname, 'src/pages/constructor.html'),
        tea: resolve(__dirname, 'src/pages/tea.html'),
      },
    },
  },
});
