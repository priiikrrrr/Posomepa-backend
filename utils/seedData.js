require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Space = require('../models/Space');

const CATEGORIES = [
  { name: 'Apartments', icon: 'home-outline', description: 'Residential apartments and flats', color: '#8B5CF6' },
  { name: 'Villas', icon: 'home', description: 'Luxury villas and houses', color: '#A78BFA' },
  { name: 'Rooftops', icon: 'sunny-outline', description: 'Rooftops and terraces', color: '#DDD6FE' },
  { name: 'Private Rooms', icon: 'bed-outline', description: 'Private rooms in shared spaces', color: '#F5D0FE' },
  { name: 'Farmhouses', icon: 'leaf-outline', description: 'Farmhouses and countryside properties', color: '#D9F99D' },
  { name: 'Day-use Rooms', icon: 'time-outline', description: 'Hotels and day-use rooms', color: '#FEF08A' },
  { name: 'Resorts', icon: 'umbrella-outline', description: 'Resorts and vacation properties', color: '#2DD4BF' },
  { name: 'Beachfront', icon: 'water-outline', description: 'Beach properties and coastal views', color: '#38BDF8' },
  { name: 'Gardens', icon: 'flower-outline', description: 'Garden spaces and lawns', color: '#4ADE80' },
  { name: 'Lawns', icon: 'leaf', description: 'Open lawn spaces', color: '#86EFAC' },
  { name: 'Open Grounds', icon: 'football-outline', description: 'Open grounds and fields', color: '#A3E635' },
  { name: 'Camping', icon: 'moon-outline', description: 'Camping spaces and tents', color: '#FB923C' },
  { name: 'Meeting Rooms', icon: 'people-outline', description: 'Meeting rooms and conference spaces', color: '#7C3AED' },
  { name: 'Coworking', icon: 'laptop-outline', description: 'Coworking desks and offices', color: '#6366F1' },
  { name: 'Private Offices', icon: 'lock-closed-outline', description: 'Private office spaces', color: '#4F46E5' },
  { name: 'Interview Rooms', icon: 'person-outline', description: 'Interview and training rooms', color: '#4338CA' },
  { name: 'Classrooms', icon: 'school-outline', description: 'Classrooms and seminar halls', color: '#0EA5E9' },
  { name: 'Workshop Rooms', icon: 'construct-outline', description: 'Workshop and tuition rooms', color: '#06B6D4' },
  { name: 'Banquet Halls', icon: 'gift-outline', description: 'Banquet and party halls', color: '#EC4899' },
  { name: 'Wedding Venues', icon: 'heart-outline', description: 'Wedding and engagement venues', color: '#F472B6' },
  { name: 'Party Halls', icon: 'happy-outline', description: 'Party and celebration spaces', color: '#DB2777' },
  { name: 'Clubs & Lounges', icon: 'wine-outline', description: 'Clubs, lounges and poolside venues', color: '#BE185D' },
  { name: 'Karaoke', icon: 'mic-outline', description: 'Karaoke rooms', color: '#9D174D' },
  { name: 'Home Theatres', icon: 'film-outline', description: 'Home theatre and screening rooms', color: '#831843' },
  { name: 'Gaming Rooms', icon: 'game-controller-outline', description: 'Gaming and VR rooms', color: '#701A75' },
  { name: 'VR Rooms', icon: 'glasses-outline', description: 'Virtual reality spaces', color: '#581C87' },
  { name: 'Gyms', icon: 'accessibility-outline', description: 'Gyms and fitness centers', color: '#F43F5E' },
  { name: 'Yoga Studios', icon: 'fitness-outline', description: 'Yoga and meditation studios', color: '#E11D48' },
  { name: 'Sports Rooms', icon: 'basketball-outline', description: 'Indoor courts and sports facilities', color: '#BE123C' },
  { name: 'Spa Rooms', icon: 'flower', description: 'Spa and wellness rooms', color: '#9F1239' },
  { name: 'Jacuzzi', icon: 'water', description: 'Jacuzzi and pool spaces', color: '#881337' },
  { name: 'Private Pools', icon: 'people-outline', description: 'Private swimming pools', color: '#F87171' },
  { name: 'Studios', icon: 'camera-outline', description: 'Photo, podcast and recording studios', color: '#EF4444' },
  { name: 'Podcast Rooms', icon: 'radio-outline', description: 'Podcast-ready rooms', color: '#DC2626' },
  { name: 'Content Creator', icon: 'images-outline', description: 'Content creator and shooting spaces', color: '#B91C1C' },
  { name: 'Influencer Spaces', icon: 'star-outline', description: 'Influencer and shooting spots', color: '#991B1B' },
  { name: 'Pop-up Shops', icon: 'storefront-outline', description: 'Pop-up shops and kiosks', color: '#78350F' },
  { name: 'Showrooms', icon: 'storefront', description: 'Showrooms and exhibition booths', color: '#92400E' },
  { name: 'Dating Spots', icon: 'heart', description: 'Private date and hangout spaces', color: '#F9A8D4' },
  { name: 'Pet-friendly', icon: 'paw-outline', description: 'Pet-friendly spaces', color: '#C084FC' },
  { name: 'Ashrams', icon: 'leaf-outline', description: 'Spiritual retreat and meditation centers', color: '#FACC15' },
  { name: 'Parking Spaces', icon: 'car-outline', description: 'Parking spaces and garages', color: '#64748B' },
  { name: 'Shared Spaces', icon: 'people', description: 'Shared living spaces', color: '#94A3B8' },
];

const SAMPLE_SPACES = [
  {
    title: 'Modern Downtown Loft',
    description: 'A beautiful modern loft in the heart of Mumbai with stunning city views. Perfect for professionals and small families.',
    images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800'],
    category: 'Apartments',
    location: { address: 'Bandra West', city: 'Mumbai', state: 'Maharashtra', coordinates: { lat: 19.0522, lng: 72.8296 } },
    price: 500,
    priceType: 'hourly',
    amenities: ['wifi', 'ac', 'parking', 'power_backup', 'furniture', 'cctv'],
    featured: true,
    rating: 4.8,
    reviewCount: 24
  },
  {
    title: 'Luxurious Penthouse Suite',
    description: 'Experience luxury living in this sprawling penthouse with private terrace and panoramic city views.',
    images: ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800'],
    category: 'Villas',
    location: { address: 'MG Road', city: 'Bangalore', state: 'Karnataka', coordinates: { lat: 12.9750, lng: 77.6060 } },
    price: 1500,
    priceType: 'hourly',
    amenities: ['wifi', 'ac', 'parking', 'power_backup', 'lift', 'security', 'cctv', 'furniture'],
    featured: true,
    rating: 5.0,
    reviewCount: 12
  },
  {
    title: 'Professional Coworking Space',
    description: 'Fully equipped coworking space with meeting rooms, high-speed internet, and professional environment.',
    images: ['https://images.unsplash.com/photo-1497366216548-37526070297c?w=800'],
    category: 'Coworking',
    location: { address: 'Connaught Place', city: 'Delhi', state: 'Delhi', coordinates: { lat: 28.6315, lng: 77.2167 } },
    price: 2000,
    priceType: 'hourly',
    amenities: ['wifi', 'ac', 'power_backup', 'lift', 'security', 'cctv', 'printer', 'phone'],
    featured: true,
    rating: 4.7,
    reviewCount: 32
  },
  {
    title: 'Corporate Meeting Room',
    description: 'Spacious meeting room equipped with audio-visual facilities, perfect for client presentations.',
    images: ['https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800'],
    category: 'Meeting Rooms',
    location: { address: 'Bandra Kurla Complex', city: 'Mumbai', state: 'Maharashtra', coordinates: { lat: 19.0637, lng: 72.8657 } },
    price: 1500,
    priceType: 'hourly',
    amenities: ['wifi', 'ac', 'projector', 'whiteboard', 'phone', 'cctv'],
    rating: 4.6,
    reviewCount: 28
  },
  {
    title: 'Grand Wedding Banquet Hall',
    description: 'Magnificent banquet hall with elegant décor, capable of hosting grand weddings and large-scale events.',
    images: ['https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800'],
    category: 'Banquet Halls',
    location: { address: 'MI Road', city: 'Jaipur', state: 'Rajasthan', coordinates: { lat: 26.9124, lng: 75.7873 } },
    price: 10000,
    priceType: 'hourly',
    amenities: ['parking', 'ac', 'power_backup', 'cctv', 'security', 'furniture'],
    featured: true,
    rating: 4.9,
    reviewCount: 15
  },
  {
    title: 'Premium Fitness Center',
    description: 'State-of-the-art gym with latest equipment and personal trainers available.',
    images: ['https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800'],
    category: 'Gyms',
    location: { address: 'Karol Bagh', city: 'Delhi', state: 'Delhi', coordinates: { lat: 28.6500, lng: 77.1900 } },
    price: 300,
    priceType: 'hourly',
    amenities: ['ac', 'parking', 'water', 'cctv', 'security'],
    rating: 4.5,
    reviewCount: 67
  },
  {
    title: 'Yoga Studio Space',
    description: 'Serene yoga studio with natural lighting, wooden floors, and peaceful atmosphere.',
    images: ['https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800'],
    category: 'Yoga Studios',
    location: { address: 'Lakshman Jhula', city: 'Rishikesh', state: 'Uttarakhand', coordinates: { lat: 30.1089, lng: 78.3296 } },
    price: 200,
    priceType: 'hourly',
    amenities: ['water', 'toilet', 'parking'],
    rating: 4.9,
    reviewCount: 33
  },
  {
    title: 'Photo Studio with Props',
    description: 'Professional photo studio with diverse props, lighting setups, and backdrops.',
    images: ['https://images.unsplash.com/photo-1598653222000-6b7b7a552625?w=800'],
    category: 'Studios',
    location: { address: 'Andheri East', city: 'Mumbai', state: 'Maharashtra', coordinates: { lat: 19.1197, lng: 72.8468 } },
    price: 500,
    priceType: 'hourly',
    amenities: ['wifi', 'ac', 'power_backup', 'cctv'],
    featured: true,
    rating: 4.7,
    reviewCount: 29
  },
  {
    title: 'Beachside Villa',
    description: 'Exclusive private villa with direct beach access and stunning ocean views.',
    images: ['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800'],
    category: 'Beachfront',
    location: { address: 'Candolim', city: 'Goa', state: 'Goa', coordinates: { lat: 15.5377, lng: 73.7658 } },
    price: 5000,
    priceType: 'daily',
    amenities: ['wifi', 'parking', 'ac', 'pool', 'cctv', 'security', 'kitchen'],
    featured: true,
    rating: 5.0,
    reviewCount: 8
  },
  {
    title: 'Spiritual Retreat Ashram',
    description: 'Peaceful ashram surrounded by nature, offering meditation and yoga sessions.',
    images: ['https://images.unsplash.com/photo-1545389336-cf090694435e?w=800'],
    category: 'Ashrams',
    location: { address: 'Parmarth Niketan', city: 'Rishikesh', state: 'Uttarakhand', coordinates: { lat: 30.1039, lng: 78.2962 } },
    price: 500,
    priceType: 'daily',
    amenities: ['wifi', 'water', 'toilet', 'parking'],
    featured: true,
    rating: 4.9,
    reviewCount: 42
  }
];

async function seedDatabase() {
  console.log('Starting database seed...\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Clear and seed categories
    await Category.deleteMany({});
    const categories = await Category.insertMany(CATEGORIES);
    console.log(`Created ${categories.length} categories`);
    console.log('Sample categories:', categories.slice(0, 5).map(c => ({ name: c.name, icon: c.icon })));

    const categoryMap = new Map(categories.map(c => [c.name, c._id]));

    // Create admin user if not exists
    let adminUser = await User.findOne({ email: 'admin@leaselink.com' });
    if (!adminUser) {
      adminUser = new User({
        email: 'admin@leaselink.com',
        password: 'admin123',
        name: 'Admin User',
        role: 'admin',
        phone: '+919876543210'
      });
      await adminUser.save();
      console.log('Created admin user');
    } else {
      console.log('Admin user already exists');
    }

    // Clear and seed spaces
    await Space.deleteMany({});
    const spacesToCreate = SAMPLE_SPACES.map(space => ({
      ...space,
      category: categoryMap.get(space.category),
      owner: adminUser._id,
      isActive: true
    }));
    
    await Space.insertMany(spacesToCreate);
    console.log(`Created ${spacesToCreate.length} sample spaces\n`);

    console.log('Database seeded successfully!');
    console.log('Admin: admin@leaselink.com');
    console.log('Password: admin123\n');

    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
seedDatabase();
