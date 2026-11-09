from core import db, now_iso

CATEGORIES = [
    {"slug": "fruits-vegetables", "name": "Fruits & Vegetables", "image": "/products/tomato.jpg"},
    {"slug": "dairy-bakery", "name": "Dairy & Bakery", "image": "/products/milk.jpg"},
    {"slug": "staples", "name": "Atta, Rice & Dal", "image": "/products/rice.jpg"},
    {"slug": "snacks-beverages", "name": "Snacks & Beverages", "image": "/products/chips.jpg"},
    {"slug": "eggs-meat-fish", "name": "Eggs, Meat & Fish", "image": "/products/eggs.jpg"},
    {"slug": "masalas-oils", "name": "Masalas & Oils", "image": "/products/masala.jpg"},
    {"slug": "personal-care", "name": "Personal Care", "image": "/products/handwash.jpg"},
    {"slug": "household", "name": "Cleaning & Household", "image": "/products/cleaner.jpg"},
]
CATEGORY_SLUGS = {c["slug"] for c in CATEGORIES}
CATEGORY_NAMES = {c["slug"]: c["name"] for c in CATEGORIES}

# id, name, category, unit, price, mrp, stock, image, tags, description
_PRODUCTS = [
    ("banana-robusta", "Banana Robusta", "fruits-vegetables", "1 dozen", 59, 72, 80, "banana", "kela fruit", "Naturally ripened Robusta bananas, rich in potassium."),
    ("shimla-apple", "Shimla Apple", "fruits-vegetables", "1 kg", 189, 230, 45, "apple", "seb fruit", "Crisp, juicy red apples from Himachal orchards."),
    ("onion", "Onion", "fruits-vegetables", "1 kg", 42, 55, 120, "onion", "pyaaz kanda vegetable sabzi", "Everyday red onions for curries, salads and tadka."),
    ("tomato-hybrid", "Tomato Hybrid", "fruits-vegetables", "1 kg", 36, 48, 110, "tomato", "tamatar vegetable sabzi", "Firm, bright hybrid tomatoes for gravies and chutneys."),
    ("potato", "Potato", "fruits-vegetables", "1 kg", 34, 45, 150, "potato", "aloo vegetable sabzi", "Fresh potatoes, great for fries, sabzi and parathas."),
    ("carrot-ooty", "Carrot Ooty", "fruits-vegetables", "500 g", 32, 40, 60, "carrot", "gajar vegetable", "Sweet, crunchy Ooty carrots."),
    ("alphonso-mango", "Alphonso Mango", "fruits-vegetables", "1 kg", 349, 420, 8, "mango", "aam hapus fruit", "Aromatic Alphonso mangoes, carbide-free ripened."),
    ("palak-spinach", "Palak (Spinach)", "fruits-vegetables", "250 g", 22, 30, 40, "spinach", "palak leafy greens vegetable", "Tender spinach leaves for palak paneer and dal."),
    ("green-capsicum", "Green Capsicum", "fruits-vegetables", "500 g", 45, 58, 50, "capsicum", "shimla mirch bell pepper vegetable", "Glossy green capsicum for stir-fries and pizzas."),
    ("pomegranate", "Pomegranate", "fruits-vegetables", "1 kg", 199, 240, 30, "pomegranate", "anaar fruit", "Ruby-red, sweet pomegranates."),
    ("cucumber", "Cucumber", "fruits-vegetables", "500 g", 24, 32, 70, "cucumber", "kheera vegetable salad", "Cool, crunchy cucumbers for salads and raita."),
    ("green-grapes", "Green Grapes", "fruits-vegetables", "500 g", 79, 99, 35, "grapes", "angoor fruit", "Seedless green grapes, sweet and juicy."),
    ("toned-milk", "Toned Milk", "dairy-bakery", "1 L", 56, 58, 90, "milk", "doodh dairy", "Fresh pasteurised toned milk."),
    ("fresh-paneer", "Fresh Paneer", "dairy-bakery", "200 g", 90, 100, 40, "paneer", "cottage cheese dairy", "Soft malai paneer made from fresh milk."),
    ("fresh-curd", "Fresh Curd", "dairy-bakery", "400 g", 45, 50, 50, "curd", "dahi yogurt dairy", "Thick, creamy set curd."),
    ("brown-bread", "Brown Bread", "dairy-bakery", "400 g", 50, 55, 35, "bread", "bakery wheat", "Soft whole wheat brown bread."),
    ("cheese-slices", "Cheddar Cheese Slices", "dairy-bakery", "200 g", 145, 160, 25, "cheese-slices", "cheese dairy", "Processed cheddar slices for sandwiches and burgers."),
    ("mozzarella-cheese", "Mozzarella Cheese", "dairy-bakery", "200 g", 160, 185, 6, "cheese-block", "cheese pizza dairy", "Stretchy mozzarella for pizzas and pastas."),
    ("salted-butter", "Salted Butter", "dairy-bakery", "100 g", 58, 60, 60, "butter", "makhan dairy", "Creamy salted table butter."),
    ("basmati-rice", "Basmati Rice", "staples", "5 kg", 649, 799, 30, "rice", "chawal grains", "Long-grain aged basmati rice for biryani and pulao."),
    ("whole-wheat-atta", "Whole Wheat Atta", "staples", "5 kg", 289, 335, 40, "atta", "flour gehu roti", "Stone-ground whole wheat atta for soft rotis."),
    ("toor-dal", "Toor Dal", "staples", "1 kg", 165, 199, 55, "toor-dal", "arhar dal lentils pulses", "Unpolished toor dal for sambar and dal tadka."),
    ("green-moong-whole", "Green Moong Whole", "staples", "1 kg", 139, 165, 35, "moong", "moong dal lentils pulses sprouts", "Whole green moong, perfect for sprouts and curries."),
    ("sugar", "Sugar", "staples", "1 kg", 48, 55, 100, "sugar", "cheeni chini sweetener", "Refined crystal sugar."),
    ("salted-potato-chips", "Classic Salted Potato Chips", "snacks-beverages", "150 g", 50, 60, 70, "chips", "snacks wafers crisps", "Crispy, lightly salted potato chips."),
    ("butter-cookies", "Butter Cookies", "snacks-beverages", "300 g", 99, 120, 45, "biscuits", "biscuits snacks", "Melt-in-the-mouth butter cookies."),
    ("assam-tea", "Assam Tea", "snacks-beverages", "500 g", 245, 280, 40, "tea", "chai patti beverage", "Strong, malty Assam CTC tea."),
    ("filter-coffee", "Filter Coffee Powder", "snacks-beverages", "200 g", 180, 210, 30, "coffee", "kaapi beverage", "South Indian filter coffee with chicory."),
    ("orange-juice", "Orange Juice", "snacks-beverages", "1 L", 120, 140, 25, "juice", "drink beverage", "100% orange juice, no added sugar."),
    ("aloo-bhujia", "Aloo Bhujia Namkeen", "snacks-beverages", "400 g", 95, 110, 50, "namkeen", "namkeen snacks", "Spicy, crunchy aloo bhujia."),
    ("brown-eggs", "Farm Fresh Brown Eggs", "eggs-meat-fish", "12 pcs", 120, 135, 40, "eggs", "anda egg protein", "Farm fresh brown eggs."),
    ("chicken-breast", "Chicken Breast Boneless", "eggs-meat-fish", "500 g", 249, 290, 20, "chicken", "chicken meat protein", "Antibiotic-residue-free boneless chicken breast."),
    ("rohu-fish", "Rohu Fish Curry Cut", "eggs-meat-fish", "500 g", 199, 240, 15, "fish", "machli fish seafood", "Freshwater rohu, cleaned and curry cut."),
    ("prawns-medium", "Prawns Medium Cleaned", "eggs-meat-fish", "250 g", 299, 350, 5, "prawns", "jhinga seafood", "Deveined medium prawns, ready to cook."),
    ("sunflower-oil", "Sunflower Oil", "masalas-oils", "1 L", 155, 185, 60, "oil", "tel cooking oil", "Light refined sunflower oil."),
    ("turmeric-powder", "Turmeric Powder", "masalas-oils", "200 g", 52, 65, 70, "turmeric", "haldi masala spices", "Pure turmeric powder with high curcumin."),
    ("red-chilli-powder", "Red Chilli Powder", "masalas-oils", "200 g", 68, 80, 65, "chilli", "lal mirch masala spices", "Bright, hot red chilli powder."),
    ("garam-masala", "Garam Masala", "masalas-oils", "100 g", 75, 90, 45, "masala", "masala spices", "Aromatic blend of whole roasted spices."),
    ("herbal-bath-soap", "Herbal Bath Soap (Pack of 4)", "personal-care", "4 x 100 g", 160, 200, 40, "soap", "soap bath", "Gentle herbal soap bars with neem and tulsi."),
    ("herbal-shampoo", "Herbal Shampoo", "personal-care", "340 ml", 225, 260, 30, "shampoo", "hair care", "Mild herbal shampoo for daily use."),
    ("fluoride-toothpaste", "Fluoride Toothpaste", "personal-care", "150 g", 95, 110, 55, "toothpaste", "oral care", "Cavity protection fluoride toothpaste."),
    ("hand-wash-refill", "Hand Wash Refill", "personal-care", "750 ml", 99, 125, 45, "handwash", "handwash soap hygiene", "Germ-protection liquid hand wash refill."),
    ("dishwash-liquid", "Dishwash Liquid", "household", "750 ml", 129, 150, 50, "dishwash", "dish cleaning utensils", "Lemon dishwash gel that cuts grease."),
    ("scrub-sponge", "Scrub Sponge (Pack of 3)", "household", "3 pcs", 45, 60, 80, "sponge", "scrubber cleaning", "Dual-sided scrub sponges for utensils."),
    ("detergent-powder", "Detergent Powder", "household", "1 kg", 115, 135, 60, "detergent", "laundry washing", "Tough-on-stains laundry detergent powder."),
    ("surface-cleaner-spray", "Multi-Surface Cleaner Spray", "household", "500 ml", 110, 130, 7, "cleaner", "floor cleaning disinfectant", "Kills 99.9% germs on kitchen and bathroom surfaces."),
]


def discount_pct(price: int, mrp: int) -> int:
    return round((mrp - price) * 100 / mrp) if mrp > price else 0


async def seed_catalog() -> None:
    if await db.products.count_documents({}) > 0:
        return
    ts = now_iso()
    docs = [{
        "id": pid, "name": name, "category": cat, "category_name": CATEGORY_NAMES[cat], "unit": unit,
        "price": price, "mrp": mrp, "discount_pct": discount_pct(price, mrp), "stock": stock,
        "image": f"/products/{img}.jpg", "tags": tags, "description": desc, "is_active": True,
        "sold": 0, "rank": i, "created_at": ts, "updated_at": ts,
    } for i, (pid, name, cat, unit, price, mrp, stock, img, tags, desc) in enumerate(_PRODUCTS)]
    await db.products.insert_many(docs)
