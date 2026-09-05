import {
  Cpu, Shirt, Droplet, Home, Watch, BookOpen, Dumbbell, ShoppingBasket,
  HeartPulse, Gamepad2, Luggage, PawPrint, Car, Briefcase, Tag,
} from 'lucide-react';

// Maps a product category name to an icon + short label. Covers the current
// seed categories plus the expanded Part-17 catalog categories, so this
// keeps working as the catalog grows without needing to touch the UI again.
const CATEGORY_META = {
  'Electronics': { icon: Cpu },
  'Fashion': { icon: Shirt },
  'Beauty': { icon: Droplet },
  'Beauty & Personal Care': { icon: Droplet },
  'Home': { icon: Home },
  'Home & Kitchen': { icon: Home },
  'Accessories': { icon: Watch },
  'Books & Stationery': { icon: BookOpen },
  'Sports & Fitness': { icon: Dumbbell },
  'Grocery': { icon: ShoppingBasket },
  'Grocery & Food': { icon: ShoppingBasket },
  'Health & Wellness': { icon: HeartPulse },
  'Toys & Games': { icon: Gamepad2 },
  'Travel': { icon: Luggage },
  'Pet Supplies': { icon: PawPrint },
  'Automotive': { icon: Car },
  'Office & Study': { icon: Briefcase },
};

export function getCategoryIcon(category) {
  return CATEGORY_META[category]?.icon || Tag;
}

export default CATEGORY_META;
