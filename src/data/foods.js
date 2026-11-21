// Vegetarian food database (no meat, no fish, no eggs, no alcohol).
// Values per listed serving. kcal, protein (p), carbs (c), fat (f), fibre (fb) in grams.
// Sources: IFCT 2017 / USDA approximations for typical home-cooked Indian portions.
const F = (id, name, emoji, serving, kcal, p, c, f, fb, cat, tags = []) => ({
  id, name, emoji, serving, kcal, p, c, f, fb, cat, tags,
});

export const FOODS = [
  // ---- Nuts, seeds & morning drinks
  F('almond_soaked', 'Soaked almonds', '🌰', '35 g (~25 pcs)', 203, 7.4, 7.6, 17.5, 4.4, 'Nuts'),
  F('walnut_soaked', 'Soaked walnuts', '🥜', '10 g (2 halves)', 65, 1.5, 1.4, 6.5, 0.7, 'Nuts'),
  F('jeera_water', 'Jeera water', '💧', '250 ml', 8, 0.3, 1.5, 0.2, 0.3, 'Drinks'),
  F('methi_water', 'Methi seed water', '💧', '250 ml', 12, 0.8, 2, 0.2, 0.8, 'Drinks'),
  F('chia_seeds', 'Chia seeds', '⚫', '10 g', 49, 1.7, 4.2, 3.1, 3.4, 'Nuts'),
  F('flax_seeds', 'Roasted flax seeds', '🟤', '10 g', 53, 1.8, 2.9, 4.2, 2.7, 'Nuts'),
  F('pumpkin_seeds', 'Pumpkin seeds', '🎃', '15 g', 84, 4.5, 1.6, 7, 0.9, 'Nuts'),
  F('peanuts_roasted', 'Roasted peanuts', '🥜', '30 g', 170, 7.5, 5, 14.5, 2.5, 'Nuts'),
  F('cashew', 'Cashews', '🥜', '15 g', 83, 2.7, 4.5, 6.6, 0.5, 'Nuts'),

  // ---- Dairy
  F('curd', 'Homemade curd (dahi)', '🥣', '150 g', 92, 5.2, 7, 4.8, 0, 'Dairy'),
  F('curd_200', 'Homemade curd (dahi)', '🥣', '200 g', 122, 7, 9.4, 6.4, 0, 'Dairy'),
  F('greek_yogurt', 'Low-fat Greek yogurt', '🥛', '120 g', 88, 12, 4.8, 2, 0, 'Dairy'),
  F('paneer_30', 'Paneer cubes', '🧀', '30 g (5 pcs)', 80, 5.5, 1.1, 6, 0, 'Dairy'),
  F('paneer_100', 'Paneer', '🧀', '100 g', 265, 18.3, 3.6, 20.8, 0, 'Dairy'),
  F('buttermilk', 'Masala buttermilk (chaas)', '🥛', '250 ml', 50, 2.8, 4.5, 2.2, 0.2, 'Dairy'),
  F('mint_raita', 'Mint raita', '🥗', '140 g', 85, 4.6, 7, 4.2, 0.6, 'Dairy'),
  F('boondi_raita', 'Boondi raita', '🥗', '150 g', 145, 5, 12, 8.5, 0.4, 'Dairy'),
  F('haldi_doodh', 'Turmeric milk (haldi doodh)', '🥛', '150 ml', 98, 4.9, 7.4, 5.3, 0.2, 'Dairy'),
  F('milk_toned', 'Toned milk', '🥛', '200 ml', 116, 6.2, 9.4, 6, 0, 'Dairy'),
  F('lassi_sweet', 'Sweet lassi', '🥤', '250 ml', 220, 7, 34, 6, 0, 'Dairy', ['sugary']),
  F('whey_protein', 'Whey protein (1 scoop, water)', '💪', '30 g', 120, 24, 3, 1.5, 0, 'Dairy'),
  F('tofu_100', 'Tofu', '⬜', '100 g', 144, 15.6, 3.5, 8.7, 2.3, 'Protein'),

  // ---- Breakfast
  F('moong_chilla', 'Sprouted moong chilla (veg stuffed)', '🥞', '300 g (2 pcs)', 330, 20, 44, 8, 9, 'Breakfast'),
  F('besan_chilla', 'Besan chilla with veggies', '🥞', '2 pcs (180 g)', 290, 14, 32, 11, 6, 'Breakfast'),
  F('paneer_chilla', 'Paneer-stuffed besan chilla', '🥞', '2 pcs (220 g)', 360, 21, 30, 17, 6, 'Breakfast'),
  F('idli_sambar', 'Idli with sambar', '🍘', '3 idli + sambar (400 g)', 320, 12, 60, 3.5, 7, 'Breakfast'),
  F('idli', 'Idli', '🍘', '1 pc (40 g)', 58, 1.9, 12, 0.2, 0.6, 'Breakfast'),
  F('plain_dosa', 'Plain dosa', '🫓', '1 medium', 168, 3.9, 29, 3.7, 1, 'Breakfast'),
  F('masala_dosa', 'Masala dosa', '🫓', '1 pc', 387, 7, 55, 15, 4, 'Breakfast'),
  F('sambar', 'Sambar', '🍲', '1 bowl (200 ml)', 130, 6, 18, 3.5, 4.5, 'Breakfast'),
  F('coconut_chutney', 'Coconut chutney', '🥥', '2 tbsp (30 g)', 70, 1, 3, 6.5, 1.5, 'Breakfast'),
  F('poha', 'Poha with peanuts & veg', '🍚', '200 g', 270, 5.5, 44, 8, 3, 'Breakfast'),
  F('upma', 'Vegetable upma', '🍚', '200 g', 250, 6, 38, 8, 3.5, 'Breakfast'),
  F('oats_milk', 'Oats porridge (milk)', '🥣', '1 bowl (40 g oats)', 260, 11, 36, 8, 4, 'Breakfast'),
  F('masala_oats', 'Masala oats with veggies', '🥣', '1 bowl', 210, 7, 33, 5, 5, 'Breakfast'),
  F('paneer_bhurji', 'Paneer bhurji with veggies', '🍳', '150 g', 290, 17, 8, 21, 2, 'Protein'),
  F('tofu_bhurji', 'Tofu bhurji with veggies', '🍳', '150 g', 190, 16, 7, 11, 2.5, 'Protein'),
  F('paneer_roll', 'Paneer kathi roll (atta)', '🌯', '150 g', 330, 15, 34, 15, 4, 'Breakfast'),
  F('bread_toast', 'Whole-wheat toast', '🍞', '1 slice (30 g)', 75, 3.6, 13, 1, 2, 'Breakfast'),
  F('peanut_butter', 'Peanut butter', '🥜', '1 tbsp (16 g)', 95, 4, 3, 8, 1, 'Breakfast'),
  F('aloo_paratha', 'Aloo paratha', '🫓', '1 pc', 290, 6, 42, 11, 4, 'Breakfast'),
  F('paneer_paratha', 'Paneer paratha', '🫓', '1 pc', 320, 12, 36, 14, 4, 'Breakfast'),
  F('thepla', 'Methi thepla', '🫓', '2 pcs', 240, 6, 32, 10, 4, 'Breakfast'),
  F('dhokla', 'Khaman dhokla', '🟨', '4 pcs (120 g)', 190, 8, 28, 5, 2.5, 'Breakfast'),
  F('vada', 'Medu vada', '🍩', '1 pc', 135, 4, 13, 7.5, 1.5, 'Breakfast', ['fried']),
  F('puri', 'Puri', '🫓', '1 pc', 101, 1.6, 10, 6, 0.6, 'Breakfast', ['fried']),
  F('sprouts_salad', 'Moong sprouts chaat', '🌱', '1 bowl (150 g)', 150, 10, 24, 1.5, 6, 'Breakfast'),
  F('veg_sandwich', 'Grilled veg sandwich', '🥪', '1 sandwich', 260, 9, 38, 8, 5, 'Breakfast'),

  // ---- Fruits
  F('fruit_seasonal', 'Seasonal fruit', '🍎', '1 serving (~170 g)', 85, 1, 21, 0.3, 3.5, 'Fruit'),
  F('apple', 'Apple', '🍎', '1 medium', 95, 0.5, 25, 0.3, 4.4, 'Fruit'),
  F('banana', 'Banana', '🍌', '1 medium', 105, 1.3, 27, 0.4, 3.1, 'Fruit'),
  F('papaya', 'Papaya', '🍈', '1 bowl (150 g)', 65, 0.7, 16, 0.4, 2.5, 'Fruit'),
  F('orange', 'Orange', '🍊', '1 medium', 62, 1.2, 15, 0.2, 3.1, 'Fruit'),
  F('guava', 'Guava', '🍐', '1 medium', 68, 2.6, 14, 1, 5.4, 'Fruit'),
  F('pomegranate', 'Pomegranate', '🔴', '1 bowl (100 g)', 83, 1.7, 19, 1.2, 4, 'Fruit'),
  F('watermelon', 'Watermelon', '🍉', '1 bowl (200 g)', 60, 1.2, 15, 0.3, 0.8, 'Fruit'),
  F('mango', 'Mango', '🥭', '1 cup (165 g)', 99, 1.4, 25, 0.6, 2.6, 'Fruit'),
  F('grapes', 'Grapes', '🍇', '1 cup (150 g)', 104, 1.1, 27, 0.2, 1.4, 'Fruit'),

  // ---- Breads & grains
  F('roti_40', 'Homemade roti', '🫓', '1 roti (40 g)', 112, 3.6, 22, 1.4, 3.2, 'Grains'),
  F('roti_80', 'Homemade roti', '🫓', '2 roti (80 g)', 224, 7.2, 44, 2.8, 6.4, 'Grains'),
  F('ragi_roti', 'Ragi roti', '🫓', '1 roti (50 g)', 120, 3, 24, 1.5, 3.5, 'Grains'),
  F('jowar_roti', 'Jowar bhakri', '🫓', '1 pc (50 g)', 130, 4, 26, 1.2, 3, 'Grains'),
  F('naan', 'Plain naan', '🫓', '1 pc', 262, 8.7, 45, 5, 2, 'Grains'),
  F('butter_naan', 'Butter naan', '🫓', '1 pc', 330, 9, 46, 12, 2, 'Grains', ['butter']),
  F('rice_cooked', 'Steamed rice', '🍚', '1 cup (150 g)', 195, 4, 43, 0.4, 0.6, 'Grains'),
  F('brown_rice', 'Brown rice', '🍚', '1 cup (150 g)', 165, 3.8, 34, 1.3, 2.7, 'Grains'),
  F('jeera_rice', 'Jeera rice', '🍚', '1 cup (150 g)', 240, 4, 42, 6, 0.8, 'Grains'),
  F('pea_pulao', 'Pea pulao', '🍚', '200 g', 290, 7.5, 50, 6.5, 4.5, 'Grains'),
  F('lentil_pulao', 'Chana dal pulao', '🍚', '225 g', 340, 12, 56, 7, 6, 'Grains'),
  F('veg_biryani', 'Veg biryani', '🍛', '1 plate (250 g)', 390, 9, 60, 12, 5, 'Grains'),
  F('khichdi', 'Moong dal khichdi', '🍲', '300 g', 330, 13, 55, 6.5, 6, 'Grains'),
  F('quinoa', 'Quinoa (cooked)', '🍚', '1 cup (185 g)', 222, 8, 39, 3.6, 5.2, 'Grains'),
  F('pasta_tomato', 'Whole-wheat pasta, tomato sauce', '🍝', '1 plate', 360, 12, 62, 7, 8, 'Grains'),
  F('veg_noodles', 'Veg hakka noodles', '🍜', '1 plate (250 g)', 420, 9, 62, 15, 4, 'Grains', ['oily']),

  // ---- Dals & legumes
  F('dal_tadka', 'Dal tadka', '🍲', '1 bowl (200 g)', 190, 10, 26, 5, 6, 'Dal'),
  F('masoor_dal', 'Masoor dal, desi-ghee jeera tadka', '🍲', '200 g', 210, 11, 26, 7, 6, 'Dal'),
  F('moong_dal', 'Yellow moong dal', '🍲', '1 bowl (200 g)', 170, 10, 24, 3.5, 5, 'Dal'),
  F('dal_makhani', 'Dal makhani', '🍲', '1 bowl (200 g)', 330, 12, 30, 18, 8, 'Dal', ['creamy']),
  F('rajma', 'Rajma curry', '🫘', '1 bowl (200 g)', 240, 12, 34, 6, 10, 'Dal'),
  F('chole', 'Chole (chickpea curry)', '🫘', '1 bowl (200 g)', 260, 11, 36, 8, 10, 'Dal'),
  F('kala_chana_kadhi', 'Kala chana kadhi', '🍲', '150 g', 170, 8, 20, 6, 6, 'Dal'),
  F('kadhi', 'Punjabi kadhi', '🍲', '1 bowl (200 g)', 180, 6, 16, 10, 1.5, 'Dal'),
  F('soya_chunks_curry', 'Soya chunks curry', '🍛', '1 bowl (200 g)', 230, 22, 18, 8, 6, 'Protein'),
  F('roasted_chana', 'Roasted chana', '🟤', '30 g', 110, 6.5, 17, 1.8, 5, 'Snack'),
  F('sambhar_rice', 'Sambar rice', '🍛', '1 plate (250 g)', 310, 9, 56, 5, 6, 'Dal'),

  // ---- Sabzi & curries
  F('roti_dal_veg', 'Roti + dal + sabzi thali', '🍱', '200 g', 300, 11, 46, 8, 8, 'Sabzi'),
  F('mix_veg', 'Mixed veg sabzi', '🥘', '1 bowl (150 g)', 120, 3.5, 13, 6, 4.5, 'Sabzi'),
  F('palak_bhurji', 'Palak paneer bhurji', '🥬', '150 g', 190, 11, 7, 13, 3, 'Sabzi'),
  F('palak_paneer', 'Palak paneer', '🥬', '1 bowl (200 g)', 290, 14, 10, 22, 4, 'Sabzi'),
  F('methi_paneer', 'Methi paneer curry', '🌿', '150 g', 240, 13, 8, 17, 3, 'Sabzi'),
  F('paneer_butter_masala', 'Paneer butter masala', '🧀', '1 bowl (200 g)', 420, 15, 14, 34, 2.5, 'Sabzi', ['creamy', 'butter']),
  F('kadai_paneer', 'Kadai paneer', '🧀', '1 bowl (200 g)', 340, 16, 12, 25, 3, 'Sabzi'),
  F('paneer_tikka', 'Paneer tikka (tandoori)', '🍢', '6 pcs (150 g)', 290, 20, 8, 20, 2, 'Protein'),
  F('soya_aloo', 'Soya aloo sabzi', '🥔', '60 g', 80, 5, 9, 2.6, 2, 'Sabzi'),
  F('aloo_gobi', 'Aloo gobi', '🥦', '1 bowl (150 g)', 150, 3.5, 18, 7, 4, 'Sabzi'),
  F('bhindi', 'Bhindi masala', '🫛', '1 bowl (150 g)', 140, 3, 12, 9, 5, 'Sabzi'),
  F('dahi_bhindi', 'Dahi bhindi', '🫛', '150 g', 150, 5, 12, 9, 4.5, 'Sabzi'),
  F('baingan_bharta', 'Baingan bharta', '🍆', '1 bowl (150 g)', 130, 3, 13, 8, 5, 'Sabzi'),
  F('lauki', 'Lauki sabzi', '🥒', '1 bowl (150 g)', 80, 2, 9, 4, 3, 'Sabzi'),
  F('veg_kofta', 'Malai kofta', '🍛', '1 bowl (200 g)', 450, 10, 26, 34, 3, 'Sabzi', ['creamy', 'fried']),
  F('mushroom_matar', 'Mushroom matar', '🍄', '1 bowl (150 g)', 150, 7, 12, 8, 4, 'Sabzi'),
  F('tofu_stirfry', 'Tofu & veg stir-fry', '🥢', '1 bowl (200 g)', 220, 16, 12, 12, 4, 'Protein'),
  F('salad', 'Green salad', '🥗', '150 g', 30, 1.4, 6, 0.2, 2.4, 'Salad'),
  F('steamed_veg_bowl', 'Steamed veggie bowl (broccoli, zucchini, carrot, beans, baby corn, cabbage, tomato)', '🥦', '1 plate (~450 g) + 1 tsp oil', 160, 7, 24, 5, 10, 'Salad'),
  F('steamed_veg_small', 'Steamed mixed veggies', '🥦', '1 bowl (200 g)', 60, 3, 11, 0.5, 4.5, 'Salad'),
  F('broccoli', 'Broccoli (steamed)', '🥦', '100 g', 35, 2.4, 7, 0.4, 3.3, 'Salad'),
  F('zucchini', 'Zucchini (steamed)', '🥒', '100 g', 17, 1.2, 3.1, 0.3, 1, 'Salad'),
  F('carrot', 'Carrot (raw/steamed)', '🥕', '100 g', 41, 0.9, 10, 0.2, 2.8, 'Salad'),
  F('beans_green', 'French beans (steamed)', '🫛', '100 g', 35, 1.9, 7.9, 0.3, 3.2, 'Salad'),
  F('baby_corn', 'Baby corn', '🌽', '50 g (5 pcs)', 13, 1, 2.5, 0.1, 1, 'Salad'),
  F('cabbage', 'Cabbage (steamed)', '🥬', '100 g', 23, 1.3, 5.5, 0.1, 1.9, 'Salad'),
  F('tomato', 'Tomato', '🍅', '1 medium (100 g)', 18, 0.9, 3.9, 0.2, 1.2, 'Salad'),
  F('cucumber', 'Cucumber', '🥒', '100 g', 15, 0.7, 3.6, 0.1, 0.5, 'Salad'),
  F('spinach', 'Spinach / palak (cooked)', '🥬', '100 g', 23, 2.9, 3.6, 0.4, 2.2, 'Salad'),
  F('oil_tsp', 'Oil / ghee', '🫗', '1 tsp (5 g)', 45, 0, 0, 5, 0, 'Salad'),
  F('kachumber', 'Kachumber salad', '🥗', '1 bowl (150 g)', 40, 1.5, 8, 0.4, 2.5, 'Salad'),
  F('veg_soup', 'Clear veg soup', '🍵', '1 bowl (250 ml)', 70, 2.5, 12, 1.5, 3, 'Salad'),
  F('tomato_soup', 'Tomato soup', '🍅', '1 bowl (250 ml)', 110, 2.5, 16, 4, 2.5, 'Salad'),

  // ---- Snacks
  F('makhana', 'Roasted makhana', '⚪', '30 g', 105, 3, 23, 0.3, 4, 'Snack'),
  F('bhel', 'Bhel puri', '🥡', '1 plate', 230, 5, 38, 7, 4, 'Snack'),
  F('maggi', 'Maggi / instant noodles', '🍜', '1 pack (70 g dry)', 310, 6.5, 44, 12, 2, 'Snack', ['fried']),
  F('maggi_veg', 'Maggi with veggies & onion', '🍜', '1 pack + veg', 340, 7.5, 50, 12, 4, 'Snack', ['fried']),
  F('onion_raw', 'Raw onion', '🧅', '½ onion (60 g)', 24, 0.7, 5.6, 0.1, 1, 'Salad'),
  F('medu_vada_2', 'Medu vada', '🍩', '2 pcs', 270, 8, 26, 15, 3, 'Snack', ['fried']),
  F('chana_dal_vada', 'Chana dal vada / masala vada', '🟤', '2 pcs', 200, 6.5, 20, 10.5, 4, 'Snack', ['fried']),
  F('vada_plate', 'Vada plate (2 medu + 4 dal vada)', '🍩', '1 plate', 670, 20, 65, 37, 10, 'Snack', ['fried']),
  F('chana_chaat', 'Chana chaat (peas/chana, peanuts, sev, veg)', '🥗', '1 bowl (250 g)', 320, 13, 42, 11, 11, 'Snack'),
  F('ghugni', 'Ghugni (yellow peas curry)', '🍲', '1 bowl (200 g)', 230, 11, 32, 6.5, 9, 'Dal'),
  F('sev_namkeen', 'Sev / namkeen', '🥨', '30 g', 165, 4, 15, 10, 1.5, 'Snack', ['fried']),
  F('chole_bhature', 'Chole bhature', '🍛', '1 plate (2 bhature)', 650, 18, 80, 30, 12, 'Snack', ['fried']),
  F('aloo_tikki', 'Aloo tikki chaat', '🥔', '2 tikki', 300, 6, 40, 13, 4, 'Snack', ['fried']),
  F('pani_puri', 'Pani puri / golgappa', '🫧', '6 pcs', 220, 4, 34, 7, 3, 'Snack', ['fried']),
  F('samosa', 'Samosa', '🥟', '1 pc', 260, 4, 30, 14, 2.5, 'Snack', ['fried']),
  F('pakora', 'Veg pakora', '🍤', '5 pcs (100 g)', 290, 7, 28, 17, 4, 'Snack', ['fried']),
  F('veg_momos', 'Steamed veg momos', '🥟', '6 pcs', 240, 7, 42, 5, 3, 'Snack'),
  F('pav_bhaji', 'Pav bhaji', '🍛', '1 plate (2 pav)', 400, 10, 58, 15, 7, 'Snack', ['butter']),
  F('vada_pav', 'Vada pav', '🍔', '1 pc', 290, 6, 40, 12, 3, 'Snack', ['fried']),
  F('pizza_veg', 'Veg pizza slice', '🍕', '1 slice (medium)', 230, 10, 28, 9, 2, 'Snack'),
  F('veg_burger', 'Veg burger', '🍔', '1 burger', 360, 10, 48, 14, 4, 'Snack'),
  F('fries', 'French fries', '🍟', 'Medium', 365, 4, 48, 17, 4.4, 'Snack', ['fried']),
  F('biscuits', 'Marie biscuits', '🍪', '4 pcs', 120, 2, 20, 3.5, 0.5, 'Snack'),
  F('protein_bar', 'Protein bar', '🍫', '1 bar (60 g)', 210, 20, 22, 7, 5, 'Snack'),
  F('dark_choc', 'Dark chocolate (70%)', '🍫', '20 g', 120, 1.6, 9, 8.5, 2.2, 'Snack'),

  // ---- Beverages
  F('water', 'Water', '💧', '250 ml', 0, 0, 0, 0, 0, 'Drinks'),
  F('chai', 'Masala chai (less sugar)', '☕', '1 cup (150 ml)', 75, 2.5, 10, 2.8, 0, 'Drinks'),
  F('black_coffee', 'Black coffee', '☕', '1 cup', 5, 0.3, 0, 0, 0, 'Drinks'),
  F('green_tea', 'Green tea', '🍵', '1 cup', 2, 0, 0, 0, 0, 'Drinks'),
  F('coconut_water', 'Coconut water', '🥥', '250 ml', 48, 1.8, 9, 0.5, 2.8, 'Drinks'),
  F('nimbu_pani', 'Nimbu pani (no sugar)', '🍋', '250 ml', 12, 0.2, 3.5, 0, 0.1, 'Drinks'),
  F('cold_drink', 'Soft drink', '🥤', '330 ml can', 140, 0, 39, 0, 0, 'Drinks', ['sugary']),
  F('fruit_juice', 'Packaged fruit juice', '🧃', '250 ml', 120, 0.5, 29, 0.3, 0.3, 'Drinks', ['sugary']),

  // ---- Sweets
  F('gulab_jamun', 'Gulab jamun', '🟤', '1 pc', 150, 2, 24, 6, 0.3, 'Sweets', ['sugary', 'fried']),
  F('kheer', 'Rice kheer', '🍮', '1 bowl (150 g)', 230, 6, 36, 7, 0.4, 'Sweets', ['sugary']),
  F('ladoo', 'Besan ladoo', '🟡', '1 pc', 185, 3.5, 20, 10, 1, 'Sweets', ['sugary']),
  F('ice_cream', 'Ice cream', '🍨', '1 scoop (70 g)', 145, 2.5, 17, 7.5, 0.5, 'Sweets', ['sugary']),
];

export const FOOD_BY_ID = Object.fromEntries(FOODS.map((f) => [f.id, f]));

export const CATEGORIES = [...new Set(FOODS.map((f) => f.cat))];

// Words that must never appear in a vegetarian log. The AI is also told this.
export const NON_VEG_WORDS = [
  'chicken', 'mutton', 'fish', 'prawn', 'shrimp', 'egg', 'omelette', 'omelet', 'meat',
  'beef', 'pork', 'lamb', 'crab', 'tuna', 'salmon', 'bacon', 'ham', 'keema', 'gelatin',
];

export const DISALLOWED_WORDS = [...NON_VEG_WORDS, 'beer', 'wine', 'whisky', 'vodka', 'rum', 'alcohol', 'cigarette'];

export function sumNutrition(items) {
  return items.reduce(
    (a, it) => {
      const q = it.qty ?? 1;
      a.kcal += (it.kcal || 0) * q;
      a.p += (it.p || 0) * q;
      a.c += (it.c || 0) * q;
      a.f += (it.f || 0) * q;
      a.fb += (it.fb || 0) * q;
      return a;
    },
    { kcal: 0, p: 0, c: 0, f: 0, fb: 0 },
  );
}

/** Return a "health score" 1-10 for a food or meal based on protein/fibre density and flags. */
export function healthScore(n, tags = []) {
  if (!n.kcal) return 10;
  let s = 6;
  const pPer100 = (n.p * 4 * 100) / n.kcal; // % kcal from protein
  const fbPer100 = (n.fb * 100) / n.kcal;
  if (pPer100 >= 25) s += 2; else if (pPer100 >= 15) s += 1; else if (pPer100 < 8) s -= 1;
  if (fbPer100 >= 3) s += 1.5; else if (fbPer100 >= 1.5) s += 0.5;
  const fatPct = (n.f * 9 * 100) / n.kcal;
  if (fatPct > 50) s -= 1.5;
  if (tags.includes('fried')) s -= 2;
  if (tags.includes('sugary')) s -= 2;
  if (tags.includes('creamy') || tags.includes('butter')) s -= 1;
  return Math.max(1, Math.min(10, Math.round(s)));
}
