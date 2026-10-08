const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

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
    stock: String
});
const Product = mongoose.model('Product', productSchema);

const orderSchema = new mongoose.Schema({
    customerName: String,
    phone: String,
    address: String,
    products: Array,
    totalPrice: Number,
    status: { type: String, default: 'Onay Bekliyor' },
    date: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// --- WEBSOCKET BAĞLANTI DİNLEYİCİSİ ---
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

app.post('/api/products', async (req, res) => {
    try {
        const { title, price, category, img, stock } = req.body;
        const newProduct = new Product({
            title: title.toUpperCase(),
            price,
            category,
            img: img || 'https://via.placeholder.com/400',
            stock: stock || 'Stokta Var'
        });
        await newProduct.save();
        res.json({ success: true, id: newProduct._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/products/:id', async (req, res) => {
    try {
        const { title, price, category, img, stock } = req.body;
        await Product.findByIdAndUpdate(req.params.id, {
            title: title.toUpperCase(),
            price,
            category,
            img,
            stock: stock || 'Stokta Var'
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

// --- SİPARİŞ API'LERİ ---
app.post('/api/orders', async (req, res) => {
    try {
        const { customerName, phone, address, products, totalPrice } = req.body;
        const newOrder = new Order({
            customerName,
            phone,
            address,
            products,
            totalPrice
        });
        await newOrder.save();

        // Yeni sipariş geldiğinde açık olan admin panellerine anında bildir!
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

// DİKKAT: Socket.io kullandığımız için sunucuyu `server.listen` ile ayağa kaldırıyoruz
server.listen(PORT, () => {
    console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
    console.log(`Yönetim Paneli: http://localhost:${PORT}/admin.html`);
});