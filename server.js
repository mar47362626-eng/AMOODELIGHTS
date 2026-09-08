const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') console.warn(`Unable to load .env: ${error.message}`);
}

const hostname = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || 3000;
const supabaseUrl = process.env.SUPABASE_URL || 'https://kkpmhunxjjyltveaqjrr.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const supabaseEnabled = Boolean(supabaseServiceKey);
const brevoApiKey = process.env.BREVO_API_KEY || '';
const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || '';
const brevoSenderName = process.env.BREVO_SENDER_NAME || 'Amoo Delights';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const data = {
  hero: {
    title: 'Delicious traditional meals delivered fresh to your door.',
    subtitle: 'Enjoy authentic, home-made quality food prepared with care and delivered fast. Order your favorites now!',
    special: 'Today\'s Special',
    specialDish: 'Jollof Rice',
    note: 'Golden, aromatic, and delicious.'
  },
  advert: {
    title: 'Weekend Deal',
    message: 'Get 20% off your first order this weekend. Fresh meals, fast delivery.',
    cta: 'Order Now'
  },
  foods: [
    {
      id: 1,
      name: 'Jollof Rice',
      description: 'Golden, aromatic rice cooked to perfection with rich tomato and spice flavors.',
      price: '$12',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'
    },
    {
      id: 2,
      name: 'White Rice',
      description: 'Fluffy, perfectly seasoned white rice - a perfect side for any meal.',
      price: '$8',
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop'
    },
    {
      id: 3,
      name: 'Amola',
      description: 'Delicious pounded yam served with savory sauce and protein.',
      price: '$10',
      image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&h=300&fit=crop'
    },
    {
      id: 4,
      name: 'Fried Chicken',
      description: 'Crispy, golden fried chicken seasoned with our special blend of spices.',
      price: '$14',
      image: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&h=300&fit=crop'
    }
  ]
};

function readJson(fileName, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, fileName), 'utf8') || JSON.stringify(fallback));
  } catch (error) {
    return fallback;
  }
}

function writeJson(fileName, value) {
  fs.writeFileSync(path.join(__dirname, fileName), JSON.stringify(value, null, 2), 'utf8');
  mirrorJsonCollection(fileName, value);
}

function supabaseEntityName(fileName) {
  return path.basename(fileName, '.json').replace(/-([a-z])/g, (_, character) => character.toUpperCase());
}

async function mirrorJsonCollection(fileName, records) {
  if (!supabaseEnabled) return;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/app_data?on_conflict=entity`, {
      method: 'POST',
      headers: { apikey: supabaseServiceKey, Authorization: `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ entity: supabaseEntityName(fileName), records, updated_at: new Date().toISOString() })
    });
    if (!response.ok) console.error(`Supabase sync failed for ${fileName}: ${response.status} ${await response.text()}`);
  } catch (error) {
    console.error(`Supabase sync failed for ${fileName}: ${error.message}`);
  }
}

function syncExistingCollections() {
  if (!supabaseEnabled) return;
  ['admin-login.json', 'inbox.json', 'order.json', 'product.json', 'rider-messages.json', 'rider.json', 'user.json', 'withdrawals.json'].forEach(fileName => mirrorJsonCollection(fileName, readJson(fileName)));
}

function readRequestBody(req, callback) {
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', () => {
    try {
      callback(null, JSON.parse(body || '{}'));
    } catch (error) {
      callback(error);
    }
  });
}

function sendJson(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

function escapeEmailHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function emailLayout(subject, content) {
  return `<!doctype html><html><body style="margin:0;background:#f7f1eb;color:#2b211c;font-family:Arial,Helvetica,sans-serif;line-height:1.6"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f1eb;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #eaded4;border-radius:14px;overflow:hidden"><tr><td style="background:#c7472f;padding:24px 28px;color:#ffffff"><div style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;font-weight:bold">Amoo Delights</div><div style="font-size:25px;line-height:1.25;font-weight:bold;margin-top:8px">${escapeEmailHtml(subject)}</div></td></tr><tr><td style="padding:30px 28px;font-size:16px">${content}</td></tr><tr><td style="padding:18px 28px;border-top:1px solid #eaded4;color:#756458;font-size:12px">Fresh meals, thoughtful service, delivered with care.</td></tr></table></td></tr></table></body></html>`;
}

function orderEmailDetails(order) {
  const itemName = order.name || order.food || 'Food order';
  const image = String(order.image || '').trim();
  return `<div style="margin:24px 0;border:1px solid #eaded4;border-radius:10px;overflow:hidden">${image ? `<img src="${escapeEmailHtml(image)}" alt="${escapeEmailHtml(itemName)}" style="display:block;width:100%;max-height:240px;object-fit:cover">` : ''}<div style="padding:18px"><h3 style="margin:0 0 12px;font-size:20px">${escapeEmailHtml(itemName)}</h3><p style="margin:6px 0;color:#756458">Order number: <strong style="color:#2b211c">${escapeEmailHtml(order.orderId)}</strong></p><p style="margin:6px 0;color:#756458">Quantity: <strong style="color:#2b211c">${escapeEmailHtml(order.quantity || '1')}</strong></p><p style="margin:6px 0;color:#756458">Total: <strong style="color:#2b211c">${escapeEmailHtml(order.total || 'Not provided')}</strong></p><p style="margin:16px 0 0;padding:10px 12px;border-radius:7px;background:#fff1ec;color:#c7472f;font-weight:bold">Status: PENDING</p></div></div>`;
}

function sendEmail(to, subject, text, html = text) {
  if (!brevoApiKey || !brevoSenderEmail || !to) {
    if (to && (!brevoApiKey || !brevoSenderEmail)) console.warn('Email skipped: configure BREVO_API_KEY and BREVO_SENDER_EMAIL.');
    return Promise.resolve(false);
  }
  return fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { accept: 'application/json', 'api-key': brevoApiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ sender: { email: brevoSenderEmail, name: brevoSenderName }, to: [{ email: String(to).trim().toLowerCase() }], subject, textContent: text, htmlContent: emailLayout(subject, html) })
  }).then(async response => {
    if (!response.ok) console.error(`Brevo email failed: ${response.status} ${await response.text()}`);
    return response.ok;
  }).catch(error => {
    console.error(`Brevo email failed: ${error.message}`);
    return false;
  });
}

function notifyEmail(to, subject, text, html = text) {
  sendEmail(to, subject, text, html).catch(() => {});
}

function createDeliveryCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = req.url === '/' ? '/index.html' : req.url === '/rider' || req.url === '/rider/' ? '/rider.html' : req.url === '/admin' || req.url === '/admin/' ? '/admin.html' : req.url;
  const safePath = path.normalize(url).replace(/^\./, '');
  const filePath = path.join(__dirname, safePath);

  if (url === '/api/home') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
    return;
  }

  // Serve products JSON via API
  if (url === '/api/products' && req.method === 'GET') {
    try {
      const products = fs.readFileSync(path.join(__dirname, 'product.json'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(products);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Unable to read products' }));
    }
    return;
  }

  if (url === '/api/products' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const product = JSON.parse(body);
        if (!product.name || !product.description || !product.price || !product.image) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Name, description, price, and image are required' }));
          return;
        }

        const productsPath = path.join(__dirname, 'product.json');
        const products = JSON.parse(fs.readFileSync(productsPath, 'utf8') || '[]');
        const newProduct = {
          id: products.reduce((highestId, item) => Math.max(highestId, Number(item.id) || 0), 0) + 1,
          name: String(product.name).trim(),
          description: String(product.description).trim(),
          price: Number(product.price),
          image: String(product.image).trim(),
          ingredients: Array.isArray(product.ingredients) ? product.ingredients.filter(Boolean).map(String) : []
        };

        if (!Number.isFinite(newProduct.price) || newProduct.price <= 0) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Price must be a positive number' }));
          return;
        }

        products.push(newProduct);
        writeJson('product.json', products);
        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, product: newProduct }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Invalid product data' }));
      }
    });
    return;
  }

  const productMatch = url.match(/^\/api\/products\/(\d+)$/);
  if (productMatch && (req.method === 'PUT' || req.method === 'DELETE')) {
    const productId = Number(productMatch[1]);
    const productsPath = path.join(__dirname, 'product.json');
    let products;
    try {
      products = JSON.parse(fs.readFileSync(productsPath, 'utf8') || '[]');
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Unable to read products' }));
      return;
    }

    const productIndex = products.findIndex(product => Number(product.id) === productId);
    if (productIndex === -1) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Product not found' }));
      return;
    }

    if (req.method === 'DELETE') {
      const deletedProduct = products.splice(productIndex, 1)[0];
      writeJson('product.json', products);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, product: deletedProduct }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const update = JSON.parse(body);
        const updatedProduct = {
          ...products[productIndex],
          name: String(update.name || '').trim(),
          description: String(update.description || '').trim(),
          price: Number(update.price),
          image: String(update.image || '').trim(),
          ingredients: Array.isArray(update.ingredients) ? update.ingredients.filter(Boolean).map(String) : []
        };
        if (!updatedProduct.name || !updatedProduct.description || !updatedProduct.image || !Number.isFinite(updatedProduct.price) || updatedProduct.price <= 0) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Name, description, image, and a positive price are required' }));
          return;
        }
        products[productIndex] = updatedProduct;
        writeJson('product.json', products);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, product: updatedProduct }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Invalid product data' }));
      }
    });
    return;
  }

  // Authenticate a registered user and return profile data without the password.
  if (url === '/api/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const credentials = JSON.parse(body);
        const email = String(credentials.email || '').trim().toLowerCase();
        const submittedPassword = String(credentials.password || '');
        const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'user.json'), 'utf8') || '[]');
        const user = users.find(item => String(item.email || '').trim().toLowerCase() === email && item.password === submittedPassword);
        if (!user) {
          res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Invalid email or password' }));
          return;
        }

        const { password: storedPassword, ...safeUser } = user;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, user: safeUser }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Invalid login data' }));
      }
    });
    return;
  }

  // Register user (append to user.json)
  if (url === '/api/register' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const user = JSON.parse(body);
        user.email = String(user.email || '').trim().toLowerCase();
        const usersPath = path.join(__dirname, 'user.json');
        let users = [];
        try {
          const existing = fs.readFileSync(usersPath, 'utf8');
          users = JSON.parse(existing || '[]');
        } catch (e) {
          users = [];
        }

        // Basic duplicate check by email
        if (users.find(u => String(u.email || '').trim().toLowerCase() === user.email)) {
          res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Email already registered' }));
          return;
        }

        user.id = Date.now();
        user.createdAt = new Date().toISOString();
        users.push(user);
        writeJson('user.json', users);

        notifyEmail(
          user.email,
          'Welcome to Amoo Delights',
          `Welcome ${user.name || 'to Amoo Delights'}! Your customer account is ready.`,
          `<h2>Welcome to Amoo Delights, ${escapeEmailHtml(user.name || 'customer')}!</h2><p>Your customer account is ready. We look forward to delivering your next meal.</p>`
        );

        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        const { password, ...safeUser } = user;
        res.end(JSON.stringify({ success: true, user: safeUser }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Invalid user data' }));
      }
    });
    return;
  }

  if (url === '/api/admin/register' && req.method === 'POST') {
    readRequestBody(req, (parseError, credentials) => {
      if (parseError || !credentials.name || !credentials.email || !credentials.password || String(credentials.password).length < 8) {
        sendJson(res, 400, { error: 'Name, email, and a password of at least 8 characters are required' });
        return;
      }
      const admins = readJson('admin-login.json');
      const email = String(credentials.email).trim().toLowerCase();
      if (admins.some(admin => admin.email === email)) {
        sendJson(res, 409, { error: 'Admin email already registered' });
        return;
      }
      const admin = { id: Date.now(), name: String(credentials.name).trim(), email, password: String(credentials.password), role: 'admin', createdAt: new Date().toISOString() };
      admins.push(admin);
      writeJson('admin-login.json', admins);
      notifyEmail(email, 'Welcome to the Amoo Delights admin team', `Welcome ${admin.name}. Your admin account is ready.`, `<h2>Welcome, ${escapeEmailHtml(admin.name)}!</h2><p>Your Amoo Delights admin account is ready.</p>`);
      const { password, ...safeAdmin } = admin;
      sendJson(res, 201, { success: true, admin: safeAdmin });
    });
    return;
  }

  if (url === '/api/admin/login' && req.method === 'POST') {
    readRequestBody(req, (parseError, credentials) => {
      const admins = readJson('admin-login.json');
      const email = String(credentials.email || '').trim().toLowerCase();
      if (parseError || String(credentials.password || '').length < 8) {
        sendJson(res, 400, { error: 'Password must be at least 8 characters' });
        return;
      }
      const admin = admins.find(item => item.email === email && item.password === String(credentials.password || ''));
      if (parseError || !admin) {
        sendJson(res, 401, { error: 'Invalid admin email or password' });
        return;
      }
      const { password, ...safeAdmin } = admin;
      sendJson(res, 200, { success: true, admin: safeAdmin });
    });
    return;
  }

  if (url === '/api/riders/register' && req.method === 'POST') {
    readRequestBody(req, (parseError, credentials) => {
      const nin = String(credentials.nin || '').trim();
      const accountNumber = String(credentials.accountNumber || '').trim();
      if (parseError || !credentials.name || !credentials.email || !credentials.password || String(credentials.password).length < 8 || !credentials.phone || !/^\d{11}$/.test(nin) || !credentials.guarantorName || !credentials.guarantorPhone || !credentials.bankName || !credentials.accountName || !/^\d{10}$/.test(accountNumber)) {
        sendJson(res, 400, { error: 'Enter an 11-digit NIN, a 10-digit bank account number, and complete all other required rider details. Passwords must be at least 8 characters.' });
        return;
      }
      const riders = readJson('rider.json');
      const email = String(credentials.email).trim().toLowerCase();
      if (riders.some(rider => rider.email === email)) {
        sendJson(res, 409, { error: 'Rider email already registered' });
        return;
      }
      const rider = { id: `RIDER-${Date.now()}`, name: String(credentials.name).trim(), email, phone: String(credentials.phone).trim(), nin, guarantorName: String(credentials.guarantorName).trim(), guarantorPhone: String(credentials.guarantorPhone).trim(), bankName: String(credentials.bankName).trim(), accountName: String(credentials.accountName).trim(), accountNumber, password: String(credentials.password), status: 'offline', earningsPerDelivery: 1500, createdAt: new Date().toISOString() };
      riders.push(rider);
      writeJson('rider.json', riders);
      notifyEmail(email, 'Welcome to Amoo Delights delivery team', `Welcome ${rider.name}. Your rider account is ready.`, `<h2>Welcome, ${escapeEmailHtml(rider.name)}!</h2><p>Your Amoo Delights rider account is ready. You can now sign in to manage assigned deliveries.</p>`);
      const { password, ...safeRider } = rider;
      sendJson(res, 201, { success: true, rider: safeRider });
    });
    return;
  }

  if (url === '/api/riders/login' && req.method === 'POST') {
    readRequestBody(req, (parseError, credentials) => {
      const riders = readJson('rider.json');
      const email = String(credentials.email || '').trim().toLowerCase();
      if (parseError || String(credentials.password || '').length < 8) {
        sendJson(res, 400, { error: 'Password must be at least 8 characters' });
        return;
      }
      const rider = riders.find(item => item.email === email && item.password === String(credentials.password || ''));
      if (parseError || !rider) {
        sendJson(res, 401, { error: 'Invalid rider email or password' });
        return;
      }
      const { password, ...safeRider } = rider;
      sendJson(res, 200, { success: true, rider: safeRider });
    });
    return;
  }

  if (url === '/api/riders' && req.method === 'GET') {
    sendJson(res, 200, readJson('rider.json').map(({ password, ...rider }) => rider));
    return;
  }

  const riderMatch = url.match(/^\/api\/riders\/([^/]+)\/status$/);
  if (riderMatch && req.method === 'PUT') {
    readRequestBody(req, (parseError, update) => {
      const riders = readJson('rider.json');
      const rider = riders.find(item => item.id === decodeURIComponent(riderMatch[1]));
      const status = String(update.status || '').toLowerCase();
      if (parseError || !rider || !['online', 'offline'].includes(status)) {
        sendJson(res, 400, { error: 'Valid rider and status are required' });
        return;
      }
      rider.status = status;
      rider.updatedAt = new Date().toISOString();
      writeJson('rider.json', riders);
      const { password, ...safeRider } = rider;
      sendJson(res, 200, { success: true, rider: safeRider });
    });
    return;
  }

  if (url === '/api/rider-assignments' && req.method === 'POST') {
    readRequestBody(req, (parseError, assignment) => {
      const orders = readJson('order.json');
      const riders = readJson('rider.json');
      const order = orders.find(item => item.orderId === assignment.orderId);
      const rider = riders.find(item => item.id === assignment.riderId);
      if (parseError || !order || !rider) {
        sendJson(res, 400, { error: 'A valid order and rider are required' });
        return;
      }
      order.riderId = rider.id;
      order.riderName = rider.name;
      order.deliveryStatus = 'ASSIGNED';
      delete order.deliveryCode;
      delete order.deliveryCodeRequestedAt;
      order.updatedAt = new Date().toISOString();
      writeJson('order.json', orders);
      const customerEmail = order.email || order.customer?.email || '';
      notifyEmail(
        rider.email,
        `New delivery assignment: ${order.orderId}`,
        `You have been assigned order ${order.orderId} for ${order.name || order.food || 'a food order'}. Request a delivery code when you are ready to deliver it.`,
        `<h2>New delivery assignment</h2><p>Order <strong>${escapeEmailHtml(order.orderId)}</strong> is assigned to you.</p><p>Request a delivery code when you are ready to deliver the order, then ask the customer for the code.</p>`
      );
      const { deliveryCode, ...safeOrder } = order;
      sendJson(res, 200, { success: true, order: safeOrder });
    });
    return;
  }

  if (url.startsWith('/api/rider/orders') && req.method === 'GET') {
    const riderId = new URL(`http://${hostname}${req.url}`).searchParams.get('riderId');
    sendJson(res, 200, readJson('order.json').filter(order => order.riderId === riderId).map(({ deliveryCode, ...order }) => order));
    return;
  }

  const deliveryCodeRequestMatch = url.match(/^\/api\/orders\/([^/]+)\/delivery-code$/);
  if (deliveryCodeRequestMatch && req.method === 'POST') {
    readRequestBody(req, (parseError, request) => {
      const orderId = decodeURIComponent(deliveryCodeRequestMatch[1]);
      const orders = readJson('order.json');
      const order = orders.find(item => String(item.orderId) === orderId);
      const rider = readJson('rider.json').find(item => item.id === request.riderId);
      if (parseError || !order || !rider || order.riderId !== rider.id || order.status === 'DELIVERED') {
        sendJson(res, 400, { error: 'A valid assigned delivery is required' });
        return;
      }
      const customerEmail = order.email || order.customer?.email || '';
      if (!customerEmail) {
        sendJson(res, 400, { error: 'This order has no customer email address' });
        return;
      }
      order.deliveryCode = createDeliveryCode();
      order.deliveryCodeRequestedAt = new Date().toISOString();
      order.updatedAt = new Date().toISOString();
      writeJson('order.json', orders);
      notifyEmail(
        customerEmail,
        `Delivery code for order ${order.orderId}`,
        `Your delivery code for order ${order.orderId} is ${order.deliveryCode}. Give it to your rider to complete delivery.`,
        `<h2>Your delivery code</h2><p>Your rider is ready to complete order <strong>${escapeEmailHtml(order.orderId)}</strong>.</p><p style="margin:24px 0;padding:18px;text-align:center;border-radius:8px;background:#fff1ec;color:#c7472f;font-size:32px;letter-spacing:6px;font-weight:bold">${escapeEmailHtml(order.deliveryCode)}</p><p>Give this code to your rider to complete delivery.</p>`
      );
      sendJson(res, 200, { success: true, message: 'Delivery code sent to the customer email' });
    });
    return;
  }

  if (url.startsWith('/api/rider/earnings') && req.method === 'GET') {
    const riderId = new URL(`http://${hostname}${req.url}`).searchParams.get('riderId');
    const orders = readJson('order.json').filter(order => order.riderId === riderId && order.status === 'DELIVERED');
    const withdrawals = readJson('withdrawals.json').filter(item => item.riderId === riderId && item.status !== 'REJECTED');
    const earned = orders.reduce((sum, order) => sum + Number(order.deliveryFee || 1500), 0);
    const withdrawn = withdrawals.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    sendJson(res, 200, { delivered: orders.length, earned, withdrawn, available: Math.max(0, earned - withdrawn), orders, withdrawals });
    return;
  }

  if (url.startsWith('/api/rider/withdrawals') && req.method === 'GET') {
    const riderId = new URL(`http://${hostname}${req.url}`).searchParams.get('riderId');
    sendJson(res, 200, readJson('withdrawals.json').filter(item => item.riderId === riderId));
    return;
  }

  if (url === '/api/withdrawals' && req.method === 'GET') {
    const riders = readJson('rider.json');
    const withdrawals = readJson('withdrawals.json');
    sendJson(res, 200, withdrawals.map(withdrawal => ({ ...withdrawal, rider: riders.find(rider => rider.id === withdrawal.riderId) ? (({ password, ...safeRider }) => safeRider)(riders.find(rider => rider.id === withdrawal.riderId)) : null })));
    return;
  }

  if (url === '/api/rider/withdrawals' && req.method === 'POST') {
    readRequestBody(req, (parseError, request) => {
      request = request || {};
      const withdrawals = readJson('withdrawals.json');
      const rider = readJson('rider.json').find(item => item.id === request.riderId);
      const deliveredOrders = readJson('order.json').filter(order => order.riderId === request.riderId && order.status === 'DELIVERED');
      const earned = deliveredOrders.reduce((sum, order) => sum + Number(order.deliveryFee || 1500), 0);
      const withdrawn = withdrawals.filter(item => item.riderId === request.riderId && item.status !== 'REJECTED').reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const available = Math.max(0, earned - withdrawn);
      const amount = Number(request.amount);
      if (parseError || !rider || !Number.isFinite(amount) || amount <= 0 || amount > available || !rider.accountNumber || request.accountNumber !== rider.accountNumber) {
        sendJson(res, 400, { error: !rider ? 'Rider session expired. Log in again.' : !rider.accountNumber ? 'Register payout account details before requesting a withdrawal.' : amount > available ? `You can withdraw up to ₦${available.toLocaleString()}.` : 'A positive amount and the registered account number are required' });
        return;
      }
      const withdrawal = { id: `WD-${Date.now()}`, riderId: rider.id, riderName: rider.name, amount, schedule: request.schedule === 'monthly' ? 'monthly' : 'weekly', bankName: rider.bankName, accountName: rider.accountName, accountNumber: rider.accountNumber, status: 'REQUESTED', requestedAt: new Date().toISOString() };
      withdrawals.push(withdrawal);
      writeJson('withdrawals.json', withdrawals);
      sendJson(res, 201, { success: true, withdrawal });
    });
    return;
  }

  if (url.startsWith('/api/rider/messages') && req.method === 'GET') {
    const riderId = new URL(`http://${hostname}${req.url}`).searchParams.get('riderId');
    sendJson(res, 200, readJson('rider-messages.json').filter(message => !riderId || message.riderId === riderId));
    return;
  }

  if (url === '/api/rider/messages' && req.method === 'POST') {
    readRequestBody(req, (parseError, message) => {
      if (parseError || !message.riderId || !message.message || !message.senderRole) {
        sendJson(res, 400, { error: 'Rider, sender role, and message are required' });
        return;
      }
      const messages = readJson('rider-messages.json');
      const savedMessage = { id: `MSG-${Date.now()}`, riderId: message.riderId, senderRole: message.senderRole, senderName: message.senderName || message.senderRole, message: String(message.message).trim(), createdAt: new Date().toISOString() };
      messages.push(savedMessage);
      writeJson('rider-messages.json', messages);
      sendJson(res, 201, { success: true, message: savedMessage });
    });
    return;
  }

  if (url === '/api/orders' && req.method === 'GET') {
    try {
      const orders = JSON.parse(fs.readFileSync(path.join(__dirname, 'order.json'), 'utf8') || '[]').map(({ deliveryCode, ...order }) => order);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(orders));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Unable to read orders' }));
    }
    return;
  }

  if (url === '/api/inbox' && req.method === 'GET') {
    try {
      const messages = fs.readFileSync(path.join(__dirname, 'inbox.json'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(messages);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Unable to read inbox' }));
    }
    return;
  }

  if (url === '/api/checkout' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      const ordersPath = path.join(__dirname, 'order.json');
      const inboxPath = path.join(__dirname, 'inbox.json');

      try {
        const checkout = JSON.parse(body);
        const order = checkout.order;
        const message = checkout.message;

        if (!order || !message || !order.orderId || !order.email || !message.title || !message.message) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'A complete order and inbox message are required' }));
          return;
        }

        const orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8') || '[]');
        const messages = JSON.parse(fs.readFileSync(inboxPath, 'utf8') || '[]');
        let productImage = String(order.image || '').trim();
        if (!productImage) {
          try {
            const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'product.json'), 'utf8') || '[]');
            const product = products.find(item => item.name === order.name || item.name === order.food);
            productImage = String(product?.image || '').trim();
          } catch (productError) {
            productImage = '';
          }
        }
        const savedOrder = { ...order, image: productImage, status: String(order.status || 'PENDING').toUpperCase(), id: order.id || Date.now(), createdAt: order.createdAt || new Date().toISOString() };
        const savedMessage = { ...message, image: productImage, id: message.id || Date.now() + 1, createdAt: message.createdAt || new Date().toISOString() };
        const originalOrders = JSON.stringify(orders, null, 2);
        const originalMessages = JSON.stringify(messages, null, 2);

        orders.push(savedOrder);
        messages.push(savedMessage);

        try {
          writeJson('order.json', orders);
          writeJson('inbox.json', messages);
        } catch (writeError) {
          fs.writeFileSync(ordersPath, originalOrders, 'utf8');
          fs.writeFileSync(inboxPath, originalMessages, 'utf8');
          throw writeError;
        }

        notifyEmail(
          savedOrder.email || savedOrder.customer?.email || '',
          `Order received: ${savedOrder.orderId}`,
          `We received your order ${savedOrder.orderId}. It is currently PENDING. We will email you when its status changes.`,
          `<h2>We received your order</h2><p>Thank you for ordering from Amoo Delights. Your order is currently <strong style="color:#c7472f">PENDING</strong>.</p>${orderEmailDetails(savedOrder)}<p>We will email you when your order status changes.</p>`
        );
        readJson('admin-login.json').forEach(admin => {
          notifyEmail(
            admin.email,
            `New order received: ${savedOrder.orderId}`,
            `A new order ${savedOrder.orderId} from ${savedOrder.email} is waiting for review.`,
            `<h2>New order waiting for review</h2><p>A new order has been placed and is currently <strong style="color:#c7472f">PENDING</strong>.</p>${orderEmailDetails(savedOrder)}<p>Customer email: ${escapeEmailHtml(savedOrder.email)}</p>`
          );
        });
        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, order: savedOrder, message: savedMessage }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Unable to save checkout records' }));
      }
    });
    return;
  }

  const orderMatch = url.match(/^\/api\/orders\/([^/]+)$/);
  if (orderMatch && req.method === 'PUT') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const orderId = decodeURIComponent(orderMatch[1]);
        const update = JSON.parse(body);
        const allowedStatuses = ['PENDING', 'APPROVED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'];
        const status = String(update.status || '').toUpperCase();
        const ordersPath = path.join(__dirname, 'order.json');
        const orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8') || '[]');
        const orderIndex = orders.findIndex(order => String(order.orderId) === orderId);

        if (orderIndex === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Order not found' }));
          return;
        }
        if (!allowedStatuses.includes(status)) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Invalid order status' }));
          return;
        }

        if (status === 'DELIVERED' && (String(update.riderId || '') !== String(orders[orderIndex].riderId || '') || String(update.deliveryCode || '') !== String(orders[orderIndex].deliveryCode || ''))) {
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'The assigned rider must provide the delivery code from the customer email' }));
          return;
        }

        const previousStatus = String(orders[orderIndex].status || '').toUpperCase();
        orders[orderIndex].status = status;
        orders[orderIndex].updatedAt = new Date().toISOString();
        const inboxPath = path.join(__dirname, 'inbox.json');
        const messages = JSON.parse(fs.readFileSync(inboxPath, 'utf8') || '[]');
        const order = orders[orderIndex];
        const customerEmail = order.email || order.customer?.email || '';

        if (status === 'APPROVED' && previousStatus !== 'APPROVED' && customerEmail) {
          const alreadyNotified = messages.some(message => message.orderId === order.orderId && message.type === 'status' && message.status === 'APPROVED');
          if (!alreadyNotified) {
            messages.push({
              email: customerEmail,
              title: 'Order approved',
              message: `Your ${order.name || order.food || 'food'} order has been approved and is being prepared.`,
              orderId: order.orderId,
              image: order.image || '',
              type: 'status',
              status: 'APPROVED',
              createdAt: new Date().toISOString()
            });
          }
        }

        const originalOrders = fs.readFileSync(ordersPath, 'utf8');
        const originalMessages = fs.readFileSync(inboxPath, 'utf8');
        try {
          writeJson('order.json', orders);
          writeJson('inbox.json', messages);
        } catch (writeError) {
          fs.writeFileSync(ordersPath, originalOrders, 'utf8');
          fs.writeFileSync(inboxPath, originalMessages, 'utf8');
          throw writeError;
        }
        if (customerEmail && status !== previousStatus) {
          const itemName = order.name || order.food || 'food';
          notifyEmail(
            customerEmail,
            `Order ${order.orderId} status: ${status}`,
            `Your ${itemName} order ${order.orderId} status is now ${status}.`,
            `<h2>Order update</h2><p>Your <strong>${escapeEmailHtml(itemName)}</strong> order <strong>${escapeEmailHtml(order.orderId)}</strong> status is now <strong>${escapeEmailHtml(status)}</strong>.</p>`
          );
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        const { deliveryCode, ...safeOrder } = orders[orderIndex];
        res.end(JSON.stringify({ success: true, order: safeOrder }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Invalid order update' }));
      }
    });
    return;
  }

  if (url === '/favicon.ico' && req.method === 'GET') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url === '/api/users' && req.method === 'GET') {
    try {
      const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'user.json'), 'utf8') || '[]');
      const safeUsers = users.map(({ password, ...user }) => user);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(safeUsers));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Unable to read users' }));
    }
    return;
  }

  if ((url === '/api/orders' || url === '/api/inbox') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const item = JSON.parse(body);
        const fileName = url === '/api/orders' ? 'order.json' : 'inbox.json';
        const file = path.join(__dirname, fileName);
        const items = JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
        items.push({ ...item, id: item.id || Date.now(), createdAt: item.createdAt || new Date().toISOString() });
        writeJson(fileName, items);
        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, item: items[items.length - 1] }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Invalid data' }));
      }
    });
    return;
  }

  if (safePath.includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}`);
  if (!supabaseEnabled) console.log('Supabase sync disabled. Set SUPABASE_SERVICE_ROLE_KEY in the server environment.');
  syncExistingCollections();
});
/*
const http = require('http');
const fs = require('fs');
const path = require('path');

const hostname = '127.0.0.1';
const port = process.env.PORT || 3000;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const data = {
  hero: {
    title: 'Delicious traditional meals delivered fresh to your door.',
    subtitle: 'Enjoy authentic, home-made quality food prepared with care and delivered fast. Order your favorites now!',
    special: 'Today\'s Special',
    specialDish: 'Jollof Rice',
    note: 'Golden, aromatic, and delicious.'
  },
  advert: {
    title: 'Weekend Deal',
    message: 'Get 20% off your first order this weekend. Fresh meals, fast delivery.',
    cta: 'Order Now'
  },
  foods: [
    {
      id: 1,
      name: 'Jollof Rice',
      description: 'Golden, aromatic rice cooked to perfection with rich tomato and spice flavors.',
      price: '$12',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'
    },
    {
      id: 2,
      name: 'White Rice',
      description: 'Fluffy, perfectly seasoned white rice - a perfect side for any meal.',
      price: '$8',
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop'
    },
    {
      id: 3,
      name: 'Amola',
      description: 'Delicious pounded yam served with savory sauce and protein.',
      price: '$10',
      image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&h=300&fit=crop'
    },
    {
      id: 4,
      name: 'Fried Chicken',
      description: 'Crispy, golden fried chicken seasoned with our special blend of spices.',
      price: '$14',
      image: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&h=300&fit=crop'
    }
  ]
};

const server = http.createServer((req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;
  const safePath = path.normalize(url).replace(/^\. /, '');
  const filePath = path.join(__dirname, safePath);

  if (url === '/api/home') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
    return;
  }

  // Serve products JSON via API
  if (url === '/api/products' && req.method === 'GET') {
    try {
      const products = fs.readFileSync(path.join(__dirname, 'product.json'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(products);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Unable to read products' }));
    }
    return;
  }

  // Register user (append to user.json)
  if (url === '/api/register' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const user = JSON.parse(body);
        const usersPath = path.join(__dirname, 'user.json');
        let users = [];
        try {
          const existing = fs.readFileSync(usersPath, 'utf8');
          users = JSON.parse(existing || '[]');
        } catch (e) {
          users = [];
        }

        // Basic duplicate check by email
        if (users.find(u => u.email === user.email)) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Email already registered' }));
          return;
        }

        user.id = Date.now();
        user.createdAt = new Date().toISOString();
        users.push(user);
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');

        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, user }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Invalid user data' }));
      }
    });
    return;
  }

  if (safePath.includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}`);
});
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  {
  "name": "amoo-backend",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "amoo-backend",
      "version": "1.0.0",
      "license": "MIT",
      "dependencies": {
        "@supabase/supabase-js": "^2.108.2",
        "axios": "^1.6.0",
        "body-parser": "^1.20.2",
        "cors": "^2.8.5",
        "dotenv": "^16.6.1",
        "express": "^4.18.2",
        "twilio": "^4.0.0"
      }
    },
    "node_modules/@supabase/auth-js": {
      "version": "2.108.2",
      "resolved": "https://registry.npmjs.org/@supabase/auth-js/-/auth-js-2.108.2.tgz",
      "integrity": "sha512-tNaQmBgodDZwgB40mRwVbxFy8IDYwjdpcZ0BYrWiwlULCSQoJj4QoG4zgJT7QRPXcqipefNOzvO/qAu4dF98ag==",
      "license": "MIT",
      "dependencies": {
        "tslib": "2.8.1"
      },
      "engines": {
        "node": ">=20.0.0"
      }
    },
    "node_modules/@supabase/functions-js": {
      "version": "2.108.2",
      "resolved": "https://registry.npmjs.org/@supabase/functions-js/-/functions-js-2.108.2.tgz",
      "integrity": "sha512-RNUX8EiBy3iLwAX19jtRzLyePnl11/fHcgwDHLnpKcDSXt/5qBnh3LUwAtIjT21Q66QsmNUR2esrHziLCpNubw==",
      "license": "MIT",
      "dependencies": {
        "tslib": "2.8.1"
      },
      "engines": {
        "node": ">=20.0.0"
      }
    },
    "node_modules/@supabase/phoenix": {
      "version": "0.4.3",
      "resolved": "https://registry.npmjs.org/@supabase/phoenix/-/phoenix-0.4.3.tgz",
      "integrity": "sha512-jZL/2uPEiK58RFJ+7rctex60AHTdtVWwqw4cqu+5JGrXdu/ZM7ZwttO+yRsRN/E/Xik6s+tmbvH7XAQux4m9nQ==",
      "license": "MIT"
    },
    "node_modules/@supabase/postgrest-js": {
      "version": "2.108.2",
      "resolved": "https://registry.npmjs.org/@supabase/postgrest-js/-/postgrest-js-2.108.2.tgz",
      "integrity": "sha512-GQ28/Y8hk3CFmkb3kXH1h/AQx6JIYSQfO0CJMRVBcEKZoNy6C45cXAZ4fcJvRC5Id0cs6xnkUV0+c0rIocigsw==",
      "license": "MIT",
      "dependencies": {
        "tslib": "2.8.1"
      },
      "engines": {
        "node": ">=20.0.0"
      }
    },
    "node_modules/@supabase/realtime-js": {
      "version": "2.108.2",
      "resolved": "https://registry.npmjs.org/@supabase/realtime-js/-/realtime-js-2.108.2.tgz",
      "integrity": "sha512-aAGxCSUemZvQIibnCdvNvgaKib28I4rfrNjKbQ9cG1uBLwUsI7hVpGXgEbypCCDhLjQlDTAiJlu7rgljYUT73g==",
      "license": "MIT",
      "dependencies": {
        "@supabase/phoenix": "^0.4.2",
        "tslib": "2.8.1"
      },
      "engines": {
        "node": ">=20.0.0"
      }
    },
    "node_modules/@supabase/storage-js": {
      "version": "2.108.2",
      "resolved": "https://registry.npmjs.org/@supabase/storage-js/-/storage-js-2.108.2.tgz",
      "integrity": "sha512-TVZPQxXGxY2+A6yTtm77zUHsh70lBhYUEaJL8RQC+BghcX/ygiMG/rmXrNVBce30/WAeNPa8FiG8HbqlGeV05g==",
      "license": "MIT",
      "dependencies": {
        "iceberg-js": "^0.8.1",
        "tslib": "2.8.1"
      },
      "engines": {
        "node": ">=20.0.0"
      }
    },
    "node_modules/@supabase/supabase-js": {
      "version": "2.108.2",
      "resolved": "https://registry.npmjs.org/@supabase/supabase-js/-/supabase-js-2.108.2.tgz",
      "integrity": "sha512-hFhnPveb5JQg4a0QYicM0swT253YHMdfeRAl2BKHOlI5VAzuHxUGSr8RbwNLYNPauWOgQMS1H8sz8bvYlgwUfQ==",
      "license": "MIT",
      "dependencies": {
        "@supabase/auth-js": "2.108.2",
        "@supabase/functions-js": "2.108.2",
        "@supabase/postgrest-js": "2.108.2",
        "@supabase/realtime-js": "2.108.2",
        "@supabase/storage-js": "2.108.2"
      },
      "engines": {
        "node": ">=20.0.0"
      }
    },
    "node_modules/accepts": {
      "version": "1.3.8",
      "resolved": "https://registry.npmjs.org/accepts/-/accepts-1.3.8.tgz",
      "integrity": "sha512-PYAthTa2m2VKxuvSD3DPC/Gy+U+sOA1LAuT8mkmRuvw+NACSaeXEQ+NHcVF7rONl6qcaxV3Uuemwawk+7+SJLw==",
      "license": "MIT",
      "dependencies": {
        "mime-types": "~2.1.34",
        "negotiator": "0.6.3"
      },
      "engines": {
        ""lodash.isplainobject": "^4.0.6",
        "lodash.isstring": "^4.0.1",
        "lodash.once": "^4.0.0",
        "ms": "^2.1.1",
      */