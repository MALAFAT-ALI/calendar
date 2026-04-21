import * as Icons from 'lucide-react';

export const PASTEL_COLORS = [
  '#fecaca', // red-200
  '#fed7aa', // orange-200
  '#fef08a', // yellow-200
  '#d9f99d', // lime-200
  '#bbf7d0', // green-200
  '#a7f3d0', // emerald-200
  '#99f6e4', // teal-200
  '#a5f3fc', // cyan-200
  '#bae6fd', // sky-200
  '#bfdbfe', // blue-200
  '#c7d2fe', // indigo-200
  '#ddd6fe', // violet-200
  '#e9d5ff', // purple-200
  '#fbcfe8', // pink-200
  '#fecdd3', // rose-200
];

export const VIBRANT_COLORS = [
  '#e11d48', // rose-600
  '#1e293b', // slate-800
  '#65a30d', // lime-600
  '#eab308', // yellow-600
  '#9333ea', // purple-600
  '#2563eb', // blue-600
  '#ea580c', // orange-600
  '#0d9488', // teal-600
  '#4f46e5', // indigo-600
  '#db2777', // pink-600
  '#0891b2', // cyan-600
  '#059669', // emerald-600
  '#7c3aed', // violet-600
  '#d97706', // amber-600
  '#dc2626', // red-600
];

export const MEDIUM_COLORS = [
  '#f87171', // red-400
  '#fb923c', // orange-400
  '#fbbf24', // amber-400
  '#facc15', // yellow-400
  '#a3e635', // lime-400
  '#4ade80', // green-400
  '#34d399', // emerald-400
  '#2dd4bf', // teal-400
  '#22d3ee', // cyan-400
  '#38bdf8', // sky-400
  '#60a5fa', // blue-400
  '#818cf8', // indigo-400
  '#a78bfa', // violet-400
  '#c084fc', // purple-400
  '#e879f9', // fuchsia-400
  '#f472b6', // pink-400
  '#fb7185', // rose-400
];

export const BUSINESS_ICONS = [
  'Briefcase', 'Monitor', 'PenTool', 'TrendingUp', 'Users', 'Calendar', 
  'FileText', 'Mail', 'PieChart', 'Target', 'Award', 'BookOpen', 'Folder', 
  'Layers', 'Layout', 'MessageSquare', 'Phone', 'Printer', 'Save', 'Server',
  'Archive', 'BarChart', 'Bookmark', 'Box', 'Building', 'Calculator', 
  'Clipboard', 'Code', 'Command', 'Compass', 'Copy', 'CreditCard', 
  'Database', 'Edit', 'ExternalLink', 'Filter', 'Flag', 'Globe', 
  'HardDrive', 'Hash', 'Headphones', 'Inbox', 'Link', 'List', 'Lock', 
  'MapPin', 'Maximize', 'Mic', 'Navigation', 'Package', 'Paperclip', 
  'Percent', 'Search', 'Send', 'Settings', 'Share', 'Shield', 'Sliders', 
  'Smartphone', 'Tablet', 'Tag', 'Terminal', 'Tool', 'Unlock', 'Upload', 
  'Video', 'Wifi'
];

export const DAILY_LIFE_ICONS = [
  'Home', 'Heart', 'Coffee', 'ShoppingCart', 'Music', 'Sun', 'Moon', 
  'Star', 'Smile', 'Activity', 'Utensils', 'Plane', 'Camera', 'Car', 
  'CloudRain', 'Droplet', 'Feather', 'Gift', 'Key', 'Map', 'Anchor', 
  'Aperture', 'Battery', 'Bell', 'Bike', 'Book', 'Cast', 'CheckCircle', 
  'Clock', 'CloudSnow', 'Crosshair', 'Eye', 'Film', 'Image', 'LifeBuoy', 
  'Radio', 'Scissors', 'ShoppingBag', 'Speaker', 'StopCircle', 'Sunrise', 
  'Sunset', 'Thermometer', 'ThumbsUp', 'ToggleRight', 'Trash', 'Truck', 
  'Tv', 'Umbrella', 'User', 'UserPlus', 'Watch', 'Wind', 'Zap', 'Gamepad', 
  'Palmtree', 'Tent', 'Ticket', 'Trophy', 'Shirt'
];

export const getIconComponent = (iconName: string) => {
  const Icon = (Icons as any)[iconName];
  return Icon || Icons.Circle;
};
