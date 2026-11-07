import type { Food, Serving } from './types';

/**
 * Built-in foods. Values are per 100 g, mostly from USDA FoodData Central (SR Legacy / FNDDS),
 * rounded. Branded items use their US label. Columns:
 *   id, name, aliases, kcal, protein, fat, carbs, fiber, servings ("name=grams|..."), default serving, brand
 * Liquids are per 100 ml and their servings are in ml (treated as grams).
 */
type Row = [string, string, string, number, number, number, number, number, string, string?, string?];

const ROWS: Row[] = [
  // grains, cereals, starches
  ['oats-dry', 'Rolled oats (dry)', 'oatmeal,oats,porridge,old fashioned oats,quaker', 379, 13.2, 6.5, 67.7, 10.1, 'cup=81|half cup=40'],
  ['oatmeal-cooked', 'Oatmeal, cooked with water', 'oatmeal cooked,porridge cooked', 71, 2.5, 1.5, 12, 1.7, 'cup=234'],
  ['cream-of-rice', 'Cream of rice (dry)', 'cream of rice,rice cereal', 370, 6, 0.6, 81, 0.6, 'cup=170|quarter cup=45'],
  ['rice-white', 'White rice, cooked', 'rice,jasmine rice,basmati rice', 130, 2.7, 0.3, 28.2, 0.4, 'cup=158'],
  ['rice-white-dry', 'White rice (dry)', 'uncooked rice,raw rice,dry rice', 365, 7.1, 0.7, 80, 1.3, 'cup=185|quarter cup=46'],
  ['rice-brown', 'Brown rice, cooked', 'brown rice', 123, 2.7, 1, 25.6, 1.6, 'cup=195'],
  ['pasta-cooked', 'Pasta, cooked', 'spaghetti,noodles,penne,macaroni', 158, 5.8, 0.9, 30.9, 1.8, 'cup=140'],
  ['pasta-dry', 'Pasta (dry)', 'dry pasta,uncooked pasta,dry spaghetti', 371, 13, 1.5, 75, 3.2, 'serving=56'],
  ['quinoa', 'Quinoa, cooked', 'quinoa', 120, 4.4, 1.9, 21.3, 2.8, 'cup=185'],
  ['bread-wheat', 'Whole wheat bread', 'bread,toast,wheat bread,whole grain bread', 252, 12.5, 3.5, 43, 6, 'slice=32', 'slice'],
  ['bread-white', 'White bread', 'white bread,sandwich bread,sourdough', 266, 8.9, 3.3, 49.4, 2.7, 'slice=28', 'slice'],
  ['bagel', 'Bagel, plain', 'bagel', 257, 10, 1.6, 50.5, 2.2, 'bagel=105', 'bagel'],
  ['english-muffin', 'English muffin', 'english muffin,muffin', 227, 8.9, 1.7, 44.2, 3.5, 'muffin=57', 'muffin'],
  ['tortilla-flour', 'Flour tortilla', 'tortilla,wrap', 306, 8.2, 8, 50, 3.5, 'tortilla=49', 'tortilla'],
  ['tortilla-corn', 'Corn tortilla', 'corn tortilla,taco shell,street taco tortilla,mini tortilla', 218, 5.7, 2.9, 44.6, 6.3, 'tortilla=26|mini tortilla=13', 'tortilla'],
  ['bun', 'Hamburger bun', 'bun,burger bun,hot dog bun', 279, 9.7, 4.1, 49.7, 2.4, 'bun=52', 'bun'],
  ['granola', 'Granola', 'granola,muesli', 471, 10, 20, 64, 7, 'cup=122|half cup=61'],
  ['cheerios', 'Cheerios', 'cereal,cheerios,breakfast cereal', 376, 12, 6.7, 73, 10, 'cup=28'],
  ['pancake', 'Pancake', 'pancakes,hotcake', 227, 6.4, 9.7, 28.3, 1, 'pancake=77', 'pancake'],
  ['waffle', 'Waffle, frozen', 'waffles,eggo', 273, 6.6, 9.2, 41, 2.2, 'waffle=35', 'waffle'],
  ['rice-cake', 'Rice cake', 'rice cakes', 387, 8.2, 2.8, 81.5, 4.2, 'cake=9', 'cake'],
  ['potato', 'Potato, baked with skin', 'potato,baked potato,potatoes', 93, 2.5, 0.1, 21, 2.2, 'medium=173', 'medium'],
  ['potato-raw', 'Potato (raw)', 'raw potato', 77, 2, 0.1, 17.5, 2.1, 'medium=213', 'medium'],
  ['sweet-potato', 'Sweet potato, baked', 'sweet potato,yam,sweet potatoes', 90, 2, 0.2, 20.7, 3.3, 'medium=114', 'medium'],
  ['sweet-potato-raw', 'Sweet potato (raw)', 'raw sweet potato', 86, 1.6, 0.1, 20.1, 3, 'medium=130', 'medium'],
  ['fries', 'French fries', 'fries,chips,french fry', 312, 3.4, 15, 41, 3.8, 'medium serving=117'],
  ['popcorn', 'Popcorn, air-popped', 'popcorn', 387, 12.9, 4.5, 77.8, 14.5, 'cup=8'],

  // fruit
  ['blueberries', 'Blueberries', 'blueberry,berries', 57, 0.7, 0.3, 14.5, 2.4, 'cup=148'],
  ['strawberries', 'Strawberries', 'strawberry', 32, 0.7, 0.3, 7.7, 2, 'cup=152|berry=12'],
  ['raspberries', 'Raspberries', 'raspberry', 52, 1.2, 0.7, 11.9, 6.5, 'cup=123'],
  ['banana', 'Banana', 'bananas', 89, 1.1, 0.3, 22.8, 2.6, 'medium=118|large=136|small=101', 'medium'],
  ['apple', 'Apple', 'apples', 52, 0.3, 0.2, 13.8, 2.4, 'medium=182|large=223|small=149', 'medium'],
  ['orange', 'Orange', 'oranges,clementine', 47, 0.9, 0.1, 11.8, 2.4, 'medium=131', 'medium'],
  ['pear', 'Pear', 'pears', 57, 0.4, 0.1, 15.2, 3.1, 'medium=178', 'medium'],
  ['peach', 'Peach', 'peaches,nectarine', 39, 0.9, 0.3, 9.5, 1.5, 'medium=150', 'medium'],
  ['grapes', 'Grapes', 'grape', 69, 0.7, 0.2, 18.1, 0.9, 'cup=151'],
  ['cherries', 'Cherries', 'cherry', 63, 1.1, 0.2, 16, 2.1, 'cup=154'],
  ['mango', 'Mango', 'mangoes', 60, 0.8, 0.4, 15, 1.6, 'cup=165'],
  ['pineapple', 'Pineapple', 'pineapple', 50, 0.5, 0.1, 13.1, 1.4, 'cup=165'],
  ['watermelon', 'Watermelon', 'melon', 30, 0.6, 0.2, 7.6, 0.4, 'cup=152'],
  ['kiwi', 'Kiwi', 'kiwifruit', 61, 1.1, 0.5, 14.7, 3, 'kiwi=69', 'kiwi'],
  ['avocado', 'Avocado', 'avocados,guacamole', 160, 2, 14.7, 8.5, 6.7, 'avocado=150|half=75', 'avocado'],
  ['dates', 'Medjool dates', 'date,dates', 277, 1.8, 0.2, 75, 6.7, 'date=24', 'date'],
  ['raisins', 'Raisins', 'raisin', 299, 3.1, 0.5, 79, 3.7, 'small box=43|cup=145'],

  // vegetables
  ['broccoli', 'Broccoli', 'broccoli', 34, 2.8, 0.4, 6.6, 2.6, 'cup=91'],
  ['spinach', 'Spinach', 'spinach', 23, 2.9, 0.4, 3.6, 2.2, 'cup=30'],
  ['kale', 'Kale', 'kale', 35, 2.9, 1.5, 4.4, 4.1, 'cup=21'],
  ['lettuce', 'Romaine lettuce', 'lettuce,salad,greens,romaine,mixed greens', 17, 1.2, 0.3, 3.3, 2.1, 'cup=47'],
  ['carrot', 'Carrot', 'carrots', 41, 0.9, 0.2, 9.6, 2.8, 'medium=61|cup=128', 'medium'],
  ['bell-pepper', 'Bell pepper', 'pepper,peppers,red pepper,green pepper', 31, 1, 0.3, 6, 2.1, 'medium=119|cup=149', 'medium'],
  ['tomato', 'Tomato', 'tomatoes', 18, 0.9, 0.2, 3.9, 1.2, 'medium=123|cup=180', 'medium'],
  ['cucumber', 'Cucumber', 'cucumbers', 15, 0.7, 0.1, 3.6, 0.5, 'cucumber=301|cup=104'],
  ['onion', 'Onion', 'onions', 40, 1.1, 0.1, 9.3, 1.7, 'medium=110|cup=160', 'medium'],
  ['green-beans', 'Green beans', 'green bean,string beans', 31, 1.8, 0.2, 7, 2.7, 'cup=100'],
  ['asparagus', 'Asparagus', 'asparagus', 20, 2.2, 0.1, 3.9, 2.1, 'spear=16', 'spear'],
  ['zucchini', 'Zucchini', 'courgette,squash', 17, 1.2, 0.3, 3.1, 1, 'medium=196|cup=124'],
  ['mushrooms', 'Mushrooms', 'mushroom', 22, 3.1, 0.3, 3.3, 1, 'cup=70'],
  ['cauliflower', 'Cauliflower', 'cauliflower', 25, 1.9, 0.3, 5, 2, 'cup=107'],
  ['brussels', 'Brussels sprouts', 'brussel sprouts,sprouts', 43, 3.4, 0.3, 9, 3.8, 'cup=88'],
  ['corn', 'Sweet corn', 'corn', 86, 3.3, 1.4, 19, 2, 'ear=90|cup=145'],
  ['peas', 'Green peas', 'peas', 81, 5.4, 0.4, 14.5, 5.7, 'cup=145'],
  ['edamame', 'Edamame', 'soybeans', 121, 11.9, 5.2, 8.9, 5.2, 'cup=155'],

  // meat, fish, eggs
  ['chicken-breast', 'Chicken breast, cooked', 'chicken,grilled chicken,chicken breast', 165, 31, 3.6, 0, 0, 'breast=172'],
  ['chicken-breast-raw', 'Chicken breast (raw)', 'raw chicken,raw chicken breast', 120, 22.5, 2.6, 0, 0, 'breast=225'],
  ['chicken-thigh', 'Chicken thigh, cooked, skinless', 'chicken thigh,thighs', 209, 26, 10.9, 0, 0, 'thigh=52', 'thigh'],
  ['chicken-thigh-raw', 'Chicken thigh (raw, skinless)', 'raw chicken thigh', 121, 19.7, 4.1, 0, 0, 'thigh=69', 'thigh'],
  ['beef-90-cooked', 'Ground beef 90/10, cooked', 'ground beef,hamburger,beef,mince', 217, 26.1, 11.7, 0, 0, 'patty=85'],
  ['beef-85-cooked', 'Ground beef 85/15, cooked', 'ground beef 85', 250, 25.9, 15.4, 0, 0, 'patty=85'],
  ['beef-93-raw', 'Ground beef 93/7 (raw)', 'raw ground beef,lean ground beef', 152, 20.9, 7, 0, 0, 'lb=454'],
  ['turkey-93-raw', 'Ground turkey 93/7 (raw)', 'ground turkey,turkey mince', 150, 18.7, 8.3, 0, 0, 'lb=454'],
  ['steak-sirloin', 'Sirloin steak, cooked', 'steak,sirloin,beef steak', 206, 29, 9, 0, 0, 'steak=170'],
  ['steak-ribeye', 'Ribeye steak, cooked', 'ribeye', 291, 24, 21, 0, 0, 'steak=225'],
  ['pork-tenderloin', 'Pork tenderloin, cooked', 'pork,pork loin', 143, 26, 3.5, 0, 0, 'serving=85'],
  ['bacon', 'Bacon, cooked', 'bacon', 541, 37, 42, 1.4, 0, 'slice=8', 'slice'],
  ['turkey-deli', 'Turkey breast, deli sliced', 'deli turkey,lunch meat,turkey slices', 104, 17, 2, 3.6, 0, 'slice=28', 'slice'],
  ['ham-deli', 'Ham, deli sliced', 'ham', 107, 16.6, 3.7, 1.5, 0, 'slice=28', 'slice'],
  ['jerky', 'Beef jerky', 'jerky', 410, 33, 25.6, 11, 1.8, 'serving=28'],
  ['salmon', 'Salmon, cooked', 'salmon,fish', 206, 22.1, 12.4, 0, 0, 'fillet=154'],
  ['tuna-can', 'Tuna, canned in water, drained', 'tuna,canned tuna', 116, 25.5, 0.8, 0, 0, 'can=113', 'can'],
  ['shrimp', 'Shrimp, cooked', 'prawns,shrimp', 99, 24, 0.3, 0.2, 0, 'shrimp=6'],
  ['tilapia', 'Tilapia, cooked', 'white fish', 128, 26, 2.7, 0, 0, 'fillet=87'],
  ['cod', 'Cod, cooked', 'cod', 105, 22.8, 0.9, 0, 0, 'fillet=180'],
  ['egg', 'Egg, large', 'eggs,whole egg,fried egg,scrambled egg,boiled egg', 143, 12.6, 9.5, 0.7, 0, 'egg=50', 'egg'],
  ['egg-white', 'Egg whites', 'egg white,liquid egg whites', 52, 10.9, 0.2, 0.7, 0, 'egg white=33|cup=243', 'egg white'],
  ['tofu', 'Tofu, firm', 'tofu', 144, 15.8, 8.7, 4.3, 2.3, 'block=396|serving=85'],
  ['tempeh', 'Tempeh', 'tempeh', 192, 20.3, 10.8, 7.6, 0, 'serving=85'],

  // dairy
  ['greek-yogurt-0', 'Greek yogurt, nonfat plain', 'greek yogurt,yogurt,fage 0,chobani', 59, 10.3, 0.4, 3.6, 0, 'container=170|cup=245'],
  ['greek-yogurt-2', 'Greek yogurt, 2% plain', 'greek yogurt 2%,fage 2', 73, 10, 1.9, 3.9, 0, 'container=170|cup=245'],
  ['cottage-cheese', 'Cottage cheese, 2%', 'cottage cheese', 84, 11, 2.3, 4.3, 0, 'cup=226|half cup=113'],
  ['milk-whole', 'Milk, whole', 'whole milk,milk', 61, 3.2, 3.3, 4.8, 0, 'cup=244'],
  ['milk-2', 'Milk, 2%', 'milk 2%,reduced fat milk', 50, 3.3, 2, 4.8, 0, 'cup=244'],
  ['milk-skim', 'Milk, skim', 'skim milk,nonfat milk,fat free milk', 34, 3.4, 0.1, 5, 0, 'cup=245'],
  ['almond-milk', 'Almond milk, unsweetened', 'almond milk', 15, 0.4, 1.1, 0.6, 0.2, 'cup=240'],
  ['oat-milk', 'Oat milk', 'oat milk,oatly', 50, 1.3, 2.1, 6.7, 0.8, 'cup=240'],
  ['cheddar', 'Cheddar cheese', 'cheese,cheddar', 403, 24.9, 33.1, 1.3, 0, 'slice=28'],
  ['mozzarella', 'Mozzarella, part-skim', 'mozzarella', 254, 24.3, 15.9, 2.8, 0, 'cup shredded=112'],
  ['string-cheese', 'String cheese', 'cheese stick,mozzarella stick', 286, 25, 21.4, 3.6, 0, 'stick=28', 'stick'],
  ['parmesan', 'Parmesan, grated', 'parmesan,parm', 431, 38.5, 28.6, 4.1, 0, 'tbsp=5'],
  ['cream-cheese', 'Cream cheese', 'cream cheese', 342, 6.2, 34, 5.5, 0, 'tbsp=14.5'],
  ['butter', 'Butter', 'butter', 717, 0.9, 81, 0.1, 0, 'tbsp=14|pat=5'],
  ['heavy-cream', 'Heavy cream', 'cream,whipping cream', 340, 2.8, 36, 2.7, 0, 'tbsp=15'],
  ['half-and-half', 'Half and half', 'creamer,half & half', 131, 3.1, 11.5, 4.3, 0, 'tbsp=15'],
  ['sour-cream', 'Sour cream', 'sour cream', 198, 2.4, 19.4, 4.6, 0, 'tbsp=12'],
  ['ice-cream', 'Ice cream, vanilla', 'ice cream', 207, 3.5, 11, 23.6, 0.7, 'half cup=66|cup=132'],

  // protein & supplements
  ['on-whey', 'Gold Standard 100% Whey', 'protein powder,protein,whey,optimum nutrition,on whey,gold standard,protein shake', 387, 77.4, 4.8, 9.7, 3.2, 'scoop=31', 'scoop', 'Optimum Nutrition'],
  ['on-casein', 'Gold Standard 100% Casein', 'casein,casein protein,optimum nutrition casein', 353, 70.6, 2.9, 8.8, 2.9, 'scoop=34', 'scoop', 'Optimum Nutrition'],
  ['whey-isolate', 'Whey protein isolate', 'isolate,whey isolate', 367, 83.3, 1.7, 3.3, 0, 'scoop=30', 'scoop'],
  ['premier-shake', 'Protein shake (30 g)', 'premier protein,protein drink,fairlife', 49, 9.2, 0.9, 1.5, 0.3, 'bottle=325', 'bottle', 'Premier Protein'],
  ['protein-bar', 'Protein bar', 'quest bar,protein bar', 333, 33.3, 13.3, 36.7, 16.7, 'bar=60', 'bar'],
  ['collagen', 'Collagen peptides', 'collagen', 350, 90, 0, 0, 0, 'scoop=10', 'scoop'],
  ['fish-oil', 'Fish oil softgel', 'fish oil,omega 3,omega-3,soft gel,softgel', 1000, 0, 100, 0, 0, 'softgel=1|capsule=1|pill=1', 'softgel'],
  ['creatine', 'Creatine monohydrate', 'creatine', 0, 0, 0, 0, 0, 'scoop=5', 'scoop'],

  // nuts, seeds, legumes, fats
  ['peanut-butter', 'Peanut butter', 'pb,peanut butter', 588, 25, 50, 20, 6, 'tbsp=16'],
  ['almond-butter', 'Almond butter', 'almond butter', 614, 21, 55.5, 18.8, 10.3, 'tbsp=16'],
  ['almonds', 'Almonds', 'almond,nuts', 579, 21.2, 49.9, 21.6, 12.5, 'almond=1.2|handful=28'],
  ['walnuts', 'Walnuts', 'walnut', 654, 15.2, 65.2, 13.7, 6.7, 'handful=28'],
  ['cashews', 'Cashews', 'cashew', 553, 18.2, 43.9, 30.2, 3.3, 'handful=28'],
  ['peanuts', 'Peanuts', 'peanut', 567, 25.8, 49.2, 16.1, 8.5, 'handful=28'],
  ['chia', 'Chia seeds', 'chia', 486, 16.5, 30.7, 42.1, 34.4, 'tbsp=12'],
  ['flax', 'Flaxseed, ground', 'flax,flaxseed,linseed', 534, 18.3, 42.2, 28.9, 27.3, 'tbsp=7'],
  ['olive-oil', 'Olive oil', 'oil,olive oil,avocado oil,cooking oil', 884, 0, 100, 0, 0, 'tbsp=13.5|tsp=4.5'],
  ['coconut-oil', 'Coconut oil', 'coconut oil', 892, 0, 99, 0, 0, 'tbsp=13.6|tsp=4.5'],
  ['hummus', 'Hummus', 'hummus', 166, 7.9, 9.6, 14.3, 6, 'tbsp=15'],
  ['black-beans', 'Black beans, cooked', 'beans,black beans', 132, 8.9, 0.5, 23.7, 8.7, 'cup=172'],
  ['kidney-beans', 'Kidney beans, cooked', 'kidney beans,pinto beans', 127, 8.7, 0.5, 22.8, 6.4, 'cup=177'],
  ['chickpeas', 'Chickpeas, cooked', 'garbanzo,chickpea', 164, 8.9, 2.6, 27.4, 7.6, 'cup=164'],
  ['lentils', 'Lentils, cooked', 'lentil', 116, 9, 0.4, 20.1, 7.9, 'cup=198'],
  ['dark-chocolate', 'Dark chocolate, 70–85%', 'chocolate,dark chocolate', 598, 7.8, 42.6, 45.9, 10.9, 'square=10'],

  // sweeteners, sauces
  ['honey', 'Honey', 'honey', 304, 0.3, 0, 82.4, 0.2, 'tbsp=21|tsp=7'],
  ['maple-syrup', 'Maple syrup', 'syrup,maple', 260, 0, 0.1, 67, 0, 'tbsp=20'],
  ['sugar', 'Sugar', 'white sugar', 387, 0, 0, 100, 0, 'tsp=4.2|tbsp=12.6'],
  ['jam', 'Jam', 'jelly,preserves', 278, 0.4, 0.1, 68.9, 1.1, 'tbsp=20'],
  ['ketchup', 'Ketchup', 'catsup', 101, 1, 0.1, 27.4, 0.3, 'tbsp=17'],
  ['mayo', 'Mayonnaise', 'mayo', 680, 1, 75, 0.6, 0, 'tbsp=13.8'],
  ['mustard', 'Mustard', 'mustard', 60, 3.7, 3.3, 5.8, 4, 'tsp=5'],
  ['bbq-sauce', 'BBQ sauce', 'barbecue sauce', 172, 0.8, 0.6, 40.8, 0.9, 'tbsp=17'],
  ['salsa', 'Salsa', 'salsa,pico', 36, 1.5, 0.2, 7, 1.9, 'tbsp=16'],
  ['soy-sauce', 'Soy sauce', 'soy,tamari', 53, 8.1, 0.6, 4.9, 0.8, 'tbsp=16'],
  ['ranch', 'Ranch dressing', 'ranch,salad dressing,dressing', 457, 1.3, 47, 5.9, 0, 'tbsp=15'],

  // snacks & prepared
  ['pizza', 'Cheese pizza', 'pizza', 266, 11.4, 9.7, 33.3, 2.3, 'slice=107', 'slice'],
  ['chips', 'Potato chips', 'crisps,potato chips', 536, 7, 34.6, 52.9, 3.1, 'serving=28'],
  ['tortilla-chips', 'Tortilla chips', 'nachos,tortilla chips', 489, 7, 23, 64, 5, 'serving=28'],
  ['pretzels', 'Pretzels', 'pretzel', 384, 10, 2.9, 80, 3, 'serving=28'],

  // drinks
  ['coffee', 'Coffee, black', 'coffee,espresso,americano', 1, 0.1, 0, 0, 0, 'cup=240', 'cup'],
  ['orange-juice', 'Orange juice', 'oj,juice', 45, 0.7, 0.2, 10.4, 0.2, 'cup=248'],
  ['cola', 'Cola', 'coke,soda,pepsi,coca cola', 42, 0, 0, 10.6, 0, 'can=355', 'can'],
  ['diet-soda', 'Diet soda', 'diet coke,coke zero,zero sugar', 0, 0, 0, 0, 0, 'can=355', 'can'],
  ['sports-drink', 'Sports drink', 'gatorade,powerade', 24, 0, 0, 6, 0, 'bottle=591', 'bottle'],
  ['beer', 'Beer', 'lager,ale,ipa', 43, 0.5, 0, 3.6, 0, 'can=355|pint=473', 'can'],
  ['light-beer', 'Light beer', 'lite beer,bud light,michelob ultra', 29, 0.2, 0, 1.6, 0, 'can=355', 'can'],
  ['wine', 'Wine', 'red wine,white wine', 85, 0.1, 0, 2.6, 0, 'glass=147', 'glass'],
];

function parseServings(s: string): Serving[] {
  return s
    .split('|')
    .filter(Boolean)
    .map((p) => {
      const [name, g] = p.split('=');
      return { name: name.trim(), grams: Number(g) };
    });
}

export const BUILTIN_FOODS: Food[] = ROWS.map((r) => {
  const [id, name, aliases, kcal, protein, fat, carbs, fiber, servings, def, brand] = r;
  const food: Food = {
    id: `b:${id}`,
    name,
    aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean),
    per100: { kcal, protein, fat, carbs, fiber },
    servings: parseServings(servings),
    source: 'builtin',
  };
  if (def) food.defaultServing = def;
  if (brand) food.brand = brand;
  return food;
});
