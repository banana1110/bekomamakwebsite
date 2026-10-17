const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const Iyzipay = require('iyzipay');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// --- 1. AYARLAR VE MIDDLEWARE'LER  ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- 2. CLOUDINARY BAĞLANTISI ---
cloudinary.config({
  cloud_name: 'n3jlkq2a',
  api_key: '971636891496482',
  api_secret: 'JvihLidPL6R6dzEHF8T1m4tYe_w'
});

// --- 3. İYZİCO SANDBOX BAĞLANTISI ---
const iyzipay = new Iyzipay({
    apiKey: 'sandbox-SjDeabOS6gCYGj5of6mLjk0adkaLSZ4F',
    secretKey: 'sandbox-ALGI9iuAXYfep31Jd9fjKih4wd4jLLkO',
    uri: 'https://sandbox-api.iyzipay.com'
});

// --- 4. MONGODB ATLAS BAĞLANTISI ---
const MONGO_URI = 'mongodb+srv://admin:beko123@cluster0.z0ysyr8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Atlas Bulut Veritabanına Bağlandı!'))
    .catch(err => console.error('Bağlantı hatası:', err));

// --- 5. ŞEMALAR VE MODELLER ---
const productSchema = new mongoose.Schema({
    title: String,
    price: Number,
    category: String,
    subCategory: { type: String, default: '' },
    img: String,
    images: [String],
    stock: String,
    warranty: { type: String, default: '3 Yıl Beko Garanti' },
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

const bannerSchema = new mongoose.Schema({
    imageUrl: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Banner = mongoose.model('Banner', bannerSchema);

io.on('connection', (socket) => {
    console.log('Bir yönetici panele bağlandı (Canlı Socket aktif).');
});

// --- 6. GÖRSEL YÜKLEME API'Sİ ---
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

// --- 7. ADMİN GİRİŞ API'Sİ ---
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

// --- 8. ÜRÜN API'LERİ ---
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ _id: -1 });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
        const { title, price, category, subCategory, images, stock, warranty, description } = req.body;
        const mainImg = (images && images.length > 0) ? images[0] : 'https://via.placeholder.com/400';
        
        const newProduct = new Product({
            title: title ? title.toUpperCase() : '',
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
            title: title ? title.toUpperCase() : '',
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

// --- 9. KAMPANYA BANNER API'LERİ ---
app.get('/api/banners', async (req, res) => {
    try {
        const banners = await Banner.find().sort({ createdAt: -1 });
        res.json(banners);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/banners', async (req, res) => {
    try {
        const { imageUrl } = req.body;
        if (!imageUrl) return res.status(400).json({ error: 'Görsel URL gereklidir.' });
        const newBanner = new Banner({ imageUrl });
        await newBanner.save();
        res.status(201).json(newBanner);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/banners/:id', async (req, res) => {
    try {
        await Banner.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 10. SİPARİŞ API'LERİ ---
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
        
        io.emit('newOrder', newOrder);
        res.json({ success: true, message: 'Sipariş başarıyla alındı!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        // Sadece ödemesi tamamlanmış veya doğrudan oluşturulmuş siparişleri listele
        const orders = await Order.find({ status: { $ne: 'Ödeme Bekliyor' } }).sort({ date: -1 });
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

// --- 11. İYZİCO ÖDEME API'LERİ (express.json'dan sonra çalışır) ---
app.post('/api/payment/initialize', async (req, res) => {
    try {
        const { buyerData, cart, totalPrice } = req.body;

        if (!buyerData) {
            return res.status(400).json({ error: 'Müşteri bilgileri eksik.' });
        }
        if (!cart || cart.length === 0) {
            return res.status(400).json({ error: 'Sepet boş.' });
        }

        const conversationId = 'ORDER_' + Date.now();
        const formattedTotal = Number(totalPrice).toFixed(2);

        let basketItems = [];
        cart.forEach((item, index) => {
            const qty = item.qty || 1;
            const unitPrice = Number(item.price).toFixed(2);
            for (let i = 0; i < qty; i++) {
                basketItems.push({
                    id: `${item._id || item.id || 'PRD'}_${index}_${i}`,
                    name: (item.title || 'Beko Ürünü').substring(0, 50),
                    category1: item.category || 'Beyaz Eşya',
                    itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
                    price: unitPrice
                });
            }
        });

        // Geçici sipariş oluştur
        const pendingOrder = new Order({
            customerName: buyerData.customerName,
            firstName: buyerData.firstName,
            lastName: buyerData.lastName,
            phone: buyerData.phone,
            address: `${buyerData.neighborhood}, ${buyerData.fullAddress}, ${buyerData.district} / Ankara`,
            addressDetails: {
                city: 'Ankara',
                district: buyerData.district,
                neighborhood: buyerData.neighborhood,
                addressDesc: buyerData.addressDesc || '',
                addressTitle: buyerData.title || ''
            },
            products: cart,
            totalPrice: Number(totalPrice),
            status: 'Ödeme Bekliyor'
        });
        await pendingOrder.save();

        const callbackUrl = `https://${req.get('host')}/api/payment/callback?orderId=${pendingOrder._id}`;

        let cleanPhone = (buyerData.phone || '').replace(/\D/g, '');
        if (!cleanPhone.startsWith('90')) cleanPhone = '90' + cleanPhone;

        const request = {
            locale: Iyzipay.LOCALE.TR,
            conversationId: conversationId,
            price: formattedTotal,
            paidPrice: formattedTotal,
            currency: Iyzipay.CURRENCY.TRY,
            basketId: pendingOrder._id.toString(),
            paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
            callbackUrl: callbackUrl,
            enabledInstallments: [1, 2, 3, 6, 9, 12],
            buyer: {
                id: 'BYR_' + pendingOrder._id,
                name: buyerData.firstName || 'Müşteri',
                surname: buyerData.lastName || 'Beko',
                gsmNumber: '+' + cleanPhone,
                email: buyerData.email || 'musteri@bekomamak.com',
                identityNumber: buyerData.tckn && buyerData.tckn.length === 11 ? buyerData.tckn : '11111111111',
                registrationAddress: buyerData.fullAddress || 'Mamak Ankara',
                ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '85.95.230.12',
                city: 'Ankara',
                country: 'Turkey'
            },
            shippingAddress: {
                contactName: buyerData.customerName,
                city: 'Ankara',
                country: 'Turkey',
                address: buyerData.fullAddress || 'Mamak Ankara',
                zipCode: buyerData.postalCode || '06260'
            },
            billingAddress: {
                contactName: buyerData.customerName,
                city: 'Ankara',
                country: 'Turkey',
                address: buyerData.fullAddress || 'Mamak Ankara',
                zipCode: buyerData.postalCode || '06260'
            },
            basketItems: basketItems
        };

        iyzipay.checkoutFormInitialize.create(request, (err, result) => {
            if (err || result.status !== 'success') {
                console.error('İyzico Başlatma Hatası:', err || result.errorMessage);
                return res.status(500).json({ error: (result && result.errorMessage) || 'Ödeme formu oluşturulamadı.' });
            }

            res.json({
                status: 'success',
                checkoutFormContent: result.checkoutFormContent,
                token: result.token
            });
        });

    } catch (err) {
        console.error('Ödeme isteği hatası:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/payment/callback', async (req, res) => {
    try {
        const token = req.body.token;
        const orderId = req.query.orderId;

        if (!token) {
            if (orderId) await Order.findByIdAndDelete(orderId);
            return res.redirect('/checkout.html?payment=failed&msg=GecersizToken');
        }

        iyzipay.checkoutForm.retrieve({
            locale: Iyzipay.LOCALE.TR,
            token: token
        }, async (err, result) => {
            console.log('iyzico Callback Sonucu:', JSON.stringify(result));

            // Ödeme Başarısız ise: Geçici siparişi veritabanından tamamen sil
            if (err || result.paymentStatus !== 'SUCCESS') {
                const errorReason = (result && (result.errorMessage || result.errorGroup || result.paymentStatus)) || 'Ödeme reddedildi.';
                console.error('Ödeme Başarısız:', errorReason);

                if (orderId) {
                    await Order.findByIdAndDelete(orderId); // <-- Panelde görünmemesi için silindi
                }
                return res.redirect(`/checkout.html?payment=failed&msg=${encodeURIComponent(errorReason)}`);
            }

            // Ödeme Başarılı ise: Sipariş durumunu kesinleştir ve admin paneline canlı aktar
            const updatedOrder = await Order.findByIdAndUpdate(
                orderId,
                { status: 'Ödeme Alındı (iyzico)' },
                { new: true }
            );

            io.emit('newOrder', updatedOrder);
            res.redirect(`/?payment=success&orderId=${orderId}`);
        });

    } catch (err) {
        console.error('Callback hatası:', err);
        res.redirect('/checkout.html?payment=failed&msg=SunucuHatasi');
    }
});

// --- 12. SUNUCUYU BAŞLAT ---
server.listen(PORT, () => {
    console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
    console.log(`Yönetim Paneli: http://localhost:${PORT}/admin.html`);
});