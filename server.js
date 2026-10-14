const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const cloudinary = require('cloudinary').v2;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// --- CLOUDINARY BAĞLANTI AYARLARI ---
cloudinary.config({
  cloud_name: 'n3jlkq2a',
  api_key: '971636891496482',
  api_secret: 'JvihLidPL6R6dzEHF8T1m4tYe_w'
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- RESİM YÜKLEME ---
app.post('/api/upload', async (req, res) => {
    try {
        const { data } = req.body;
        if (!data) return res.status(400).json({ error: 'Geçersiz resim dosyası' });

        const uploadResponse = await cloudinary.uploader.upload(data, {
            folder: 'beko_mamak_urunler'
        });

        res.json({ success: true, url: uploadResponse.secure_url });
    } catch (err) {
        console.error('Cloudinary Yükleme Hatası:', err);
        res.status(500).json({ error: 'Resim buluta yüklenemedi: ' + err.message });
    }
});

// --- MONGODB ATLAS BAĞLANTISI ---
const MONGO_URI = 'mongodb+srv://admin:beko123@cluster0.z0ysyr8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Atlas Bulut Veritabanına Bağlandı!'))
    .catch(err => console.error('Bağlantı hatası:', err));

// --- ŞEMALAR VE MODELLER ---
const productSchema = new mongoose.Schema({
    title: String,
    price: Number,
    category: String,
    img: String,
    images: [String],
    stock: String,
    warranty: { type: String, default: '3 Yıl Beko Garanti' },
    subCategory: { type: String, default: '' },
    description: { type: String, default: '' }
});
const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    customerName: String,
    firstName: String,
    lastName: String,
    phone: String,
    address: String,
    addressDetails: {
        city: { type: String, default: 'Ankara' },
        district: String,
        neighborhood: String,
        buildingNo: String,
        floor: String,
        apartmentNo: String,
        addressDesc: String,
        addressTitle: String
    },
    products: Array,
    totalPrice: Number,
    status: { type: String, default: 'Onay Bekliyor' },
    date: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

io.on('connection', (socket) => {
    console.log('Bir yönetici panele bağlandı (Canlı Socket aktif).');
});

// --- API: MONGODB ATLAS BİLGİLERİYLE ADMIN GİRİŞİ ---
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const testUri = `mongodb+srv://${email}:${password}@cluster0.z0ysyr8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
        const connection = await mongoose.createConnection(testUri).asPromise();
        await connection.close();
        res.json({ success: true, message: 'Giriş başarılı!' });
    } catch (err) {
        res.status(400).json({ success: false, error: 'Hatalı kullanıcı adı veya şifre!' });
    }
});

// --- ÜRÜN API'LERİ ---
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ _id: -1 });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

    // --- TEK ÜRÜN DETAYI API'Sİ ---
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: 'Ürün bulunamadı' });
        res.json(product);
    } catch (err) {
        res.status(500).json({ error: 'Geçersiz ürün ID' });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const { title, price, category, images, stock, warranty, description } = req.body;
        const mainImg = (images && images.length > 0) ? images[0] : 'https://via.placeholder.com/400';
        
        const newProduct = new Product({
            title: title.toUpperCase(),
            price,
            category,
            subCategory: subCategory || '',
            img: mainImg,
            images: images || [],
            stock: stock || 'Stokta Var',
            warranty: warranty || '3 Yıl Beko Garanti',
            description: description || ''
        });
        await newProduct.save();
        res.json({ success: true, id: newProduct._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const { title, subCategory, price, category, images, stock, warranty, description } = req.body;
        const mainImg = (images && images.length > 0) ? images[0] : 'https://via.placeholder.com/400';
        
        await Product.findByIdAndUpdate(req.params.id, {
            title: title.toUpperCase(),
            price,
            category,
            subCategory: subCategory || '',
            img: mainImg,
            images: images || [],
            stock: stock || 'Stokta Var',
            warranty: warranty || '3 Yıl Beko Garanti',
            description: description || ''
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SİPARİŞ API'LERİ (Detaylı Ankara Adresli) ---
app.post('/api/orders', async (req, res) => {
    try {
        const { 
            customerName, 
            firstName, 
            lastName, 
            phone, 
            address, 
            addressDetails, 
            products, 
            totalPrice 
        } = req.body;

        const newOrder = new Order({
            customerName: customerName || `${firstName || ''} ${lastName || ''}`.trim(),
            firstName: firstName || '',
            lastName: lastName || '',
            phone,
            address,
            addressDetails: addressDetails || {},
            products,
            totalPrice
        });
        await newOrder.save();
        
        // Yeni sipariş geldiğinde anlık olarak admin paneline socket ile fırlat
        io.emit('newOrder', newOrder);

        res.json({ success: true, message: 'Sipariş başarıyla alındı!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ date: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/orders/:id', async (req, res) => {
    try {
        await Order.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

server.listen(PORT, () => {
    console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
    console.log(`Yönetim Paneli: http://localhost:${PORT}/admin.html`);
});
