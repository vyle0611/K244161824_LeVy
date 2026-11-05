// ===== Biến dùng chung =====
var loginForm = document.getElementById('admin-content').innerHTML; // Lưu form đăng nhập để dùng lại khi đăng xuất
var allProducts = [];   // Danh sách sản phẩm đọc từ products.xml
var ratings = {};       // Đánh giá theo product_id (Câu 5)
var customers = [];     // Danh sách khách hàng (JSON)
var currentEmp = null;  // Nhân viên đang đăng nhập
var cart = { items: [], total: 0 };  // Đối tượng giỏ hàng (Câu 6)

// Hàm hỗ trợ trích xuất text từ thẻ XML
function getText(node, tag) {
    var el = node.getElementsByTagName(tag)[0];
    return el ? el.textContent : '';
}

// Hàm đọc file JSON
async function readJSON(path) {
    var res = await fetch(path);
    return await res.json();
}

// Tìm tên theo ID trong danh sách
function nameOf(list, id) {
    for (var i = 0; i < list.length; i++) {
        if (list[i].id == id) return list[i].name;
    }
    return id;
}

// Lấy đối tượng sản phẩm theo ID
function getProduct(id) {
    for (var i = 0; i < allProducts.length; i++) {
        if (allProducts[i].id == id) return allProducts[i];
    }
}

// Chuyển đổi giữa các tab giao diện
function showSection(sectionId) {
    var ids = ['products', 'xml-convert', 'carts', 'admin'];
    for (var i = 0; i < ids.length; i++) {
        document.getElementById('sec-' + ids[i]).style.display = 'none';
    }
    document.getElementById('sec-' + sectionId).style.display = 'block';

    if (sectionId == 'products') {
        showSkeleton();
        setTimeout(loadProducts, 800); // Giả lập Skeleton Loading trong 0.8 giây
    }
    if (sectionId == 'xml-convert') {
        document.getElementById('xml-output').value = localStorage.getItem('products.xml') || '';
    }
    if (sectionId == 'carts') loadCartsXML();
    if (sectionId == 'admin' && currentEmp != null) showDashboard();
}

// ===== CÂU 1: Đọc FakeStoreAPI, dùng DOM bổ sung Màu sắc + Tồn kho -> products.xml (localStorage) =====
function addNode(xmlDoc, parent, name, value) {
    var node = xmlDoc.createElement(name);
    node.textContent = value;
    parent.appendChild(node);
}

async function createProductsXML() {
    var res = await fetch('https://fakestoreapi.com/products');
    var data = await res.json();
    var xmlDoc = document.implementation.createDocument('', '', null);
    var root = xmlDoc.createElement('products');
    var colors = ['Đỏ', 'Xanh', 'Đen', 'Trắng'];

    for (var i = 0; i < data.length; i++) {
        var p = data[i];
        var node = xmlDoc.createElement('product');
        addNode(xmlDoc, node, 'id', p.id);
        addNode(xmlDoc, node, 'title', p.title);
        addNode(xmlDoc, node, 'price', p.price);
        addNode(xmlDoc, node, 'category', p.category);
        addNode(xmlDoc, node, 'description', p.description);
        addNode(xmlDoc, node, 'color', colors[p.id % 4]);
        addNode(xmlDoc, node, 'stock', Math.floor(Math.random() * 50) + 1);
        addNode(xmlDoc, node, 'image', p.image);
        root.appendChild(node);
    }
    xmlDoc.appendChild(root);

    var xmlString = new XMLSerializer().serializeToString(xmlDoc);
    localStorage.setItem('products.xml', xmlString);
    return xmlString;
}

async function fetchAndConvertToXML() {
    try {
        var xmlString = await createProductsXML();
        document.getElementById('xml-output').value = xmlString;
        alert('Đã đọc API, thêm Màu sắc & Tồn kho thành công vào products.xml!');
    } catch (err) {
        alert('Lỗi khi tải dữ liệu từ API!');
    }
}

// ===== CÂU 5: Đọc reviews.xml, tính điểm trung bình theo product_id =====
async function loadReviews() {
    try {
        var res = await fetch('data/reviews.xml');
        if (!res.ok) return {};
        var text = await res.text();
        var xmlDoc = new DOMParser().parseFromString(text, 'text/xml');
        var reviews = xmlDoc.getElementsByTagName('review');
        var result = {};

        for (var i = 0; i < reviews.length; i++) {
            var id = getText(reviews[i], 'product_id');
            var rating = Number(getText(reviews[i], 'rating'));
            if (result[id] == undefined) result[id] = { sum: 0, count: 0, list: [] };
            result[id].sum += rating;
            result[id].count++;
            result[id].list.push({
                customerId: getText(reviews[i], 'customer_id'),
                rating: rating,
                comment: getText(reviews[i], 'comment')
            });
        }
        return result;
    } catch (e) {
        return {};
    }
}

function avgRating(id) {
    if (ratings[id] == undefined || ratings[id].count == 0) return 0;
    return ratings[id].sum / ratings[id].count;
}

// Tạo thẻ <span> số sao trung bình chèn lên ảnh sản phẩm trên DOM
function addRatingBadges() {
    var cards = document.getElementsByClassName('product-card');
    for (var i = 0; i < cards.length; i++) {
        var id = cards[i].getAttribute('data-id');
        if (ratings[id] != undefined && ratings[id].count > 0) {
            var span = document.createElement('span');
            span.className = 'star-badge';
            span.textContent = avgRating(id).toFixed(1) + ' sao';
            var imgBox = cards[i].getElementsByClassName('img-box')[0];
            if (imgBox) imgBox.appendChild(span);
        }
    }
}

// Danh sách khách hàng đã đánh giá (hiển thị khi click Rating Detail)
function ratingListHTML(id) {
    if (ratings[id] == undefined || ratings[id].list.length == 0) return '<li>Chưa có đánh giá</li>';
    var html = '';
    var list = ratings[id].list;
    for (var i = 0; i < list.length; i++) {
        html += '<li>' + nameOf(customers, list[i].customerId) + ': ' + list[i].rating + ' sao - ' + list[i].comment + '</li>';
    }
    return html;
}

// ===== CÂU 2 & 3: Hiển thị sản phẩm + Lọc dữ liệu + Skeleton Loading =====
function showSkeleton() {
    var html = '';
    for (var i = 0; i < 8; i++) {
        html += '<div class="product-card skeleton"></div>';
    }
    document.getElementById('product-list').innerHTML = html;
}

async function loadProducts() {
    var box = document.getElementById('product-list');
    var xmlStr = localStorage.getItem('products.xml');

    // NẾU CHƯA FETCH API -> Hiện thông báo hướng dẫn thay vì tự chạy
    if (xmlStr == null) {
        box.innerHTML = '<p style="padding: 20px; font-size: 16px;">Chưa có dữ liệu XML. Vui lòng sang tab <b>"Tải & Chuyển XML"</b> và bấm nút <b>Fetch</b>!</p>';
        return;
    }

    try {
        ratings = await loadReviews();
        customers = await readJSON('data/customers.json');
    } catch (err) {
        box.innerHTML = '<p>Không tải được dữ liệu phụ (Cần chạy trên Live Server)!</p>';
        return;
    }

    var xmlDoc = new DOMParser().parseFromString(xmlStr, 'text/xml');
    var list = xmlDoc.getElementsByTagName('product');
    allProducts = [];

    for (var i = 0; i < list.length; i++) {
        allProducts.push({
            id: getText(list[i], 'id'),
            title: getText(list[i], 'title'),
            price: Number(getText(list[i], 'price')),
            category: getText(list[i], 'category'),
            description: getText(list[i], 'description'),
            color: getText(list[i], 'color'),
            stock: getText(list[i], 'stock'),
            image: getText(list[i], 'image')
        });
    }

    // Tự động điền danh mục vào dropdown Search (chỉ chạy 1 lần)
    var select = document.getElementById('category');
    if (select && select.options.length == 1) {
        var cats = [];
        for (var j = 0; j < allProducts.length; j++) {
            if (cats.indexOf(allProducts[j].category) == -1) {
                cats.push(allProducts[j].category);
                select.innerHTML += '<option value="' + allProducts[j].category + '">' + allProducts[j].category + '</option>';
            }
        }
    }

    applyFilter();
}

function renderProducts(list) {
    var box = document.getElementById('product-list');
    if (list.length == 0) {
        box.innerHTML = '<p style="padding: 20px;">Không có sản phẩm phù hợp.</p>';
        return;
    }
    var html = '';
    for (var i = 0; i < list.length; i++) {
        var p = list[i];
        html += '<article class="product-card" data-id="' + p.id + '">' +
            '<div class="img-box"><img src="' + p.image + '" alt=""></div>' +
            '<h4>' + p.title.substring(0, 20) + '...</h4>' +
            '<p>Giá: $' + p.price + '</p>' +
            '<p>Màu: <b>' + p.color + '</b></p>' +
            '<p>Tồn kho: <b>' + p.stock + '</b></p>' +
            '<button data-action="add" data-id="' + p.id + '" data-variant="' + p.color + '">Thêm vào giỏ hàng</button>' +
            '<button data-action="view" data-id="' + p.id + '" data-variant="' + p.color + '">Xem nhanh</button>' +
            '<button data-action="rating">Rating Detail</button>' +
            '<ul class="rating-list" hidden>' + ratingListHTML(p.id) + '</ul>' +
            '</article>';
    }
    box.innerHTML = html;
    addRatingBadges();
}

function applyFilter() {
    var keywordEl = document.getElementById('keyword');
    var keyword = keywordEl ? keywordEl.value.toLowerCase() : '';

    var minEl = document.getElementById('min-price');
    var min = (minEl && minEl.value !== '') ? Number(minEl.value) : 0;

    var maxEl = document.getElementById('max-price');
    var max = (maxEl && maxEl.value !== '') ? Number(maxEl.value) : Infinity;

    var ratingEl = document.getElementById('rating');
    var minRating = (ratingEl && ratingEl.value !== '') ? Number(ratingEl.value) : 0;

    var categoryEl = document.getElementById('category');
    var category = categoryEl ? categoryEl.value : '';

    var color = '';
    var radios = document.getElementsByName('color');
    for (var i = 0; i < radios.length; i++) {
        if (radios[i].checked) color = radios[i].value;
    }

    if (min > max) {
        alert('Giá từ phải nhỏ hơn hoặc bằng giá đến!');
        return;
    }

    var result = [];
    for (var j = 0; j < allProducts.length; j++) {
        var p = allProducts[j];
        if (p.title.toLowerCase().indexOf(keyword) != -1 &&
            p.price >= min && p.price <= max &&
            (color == '' || p.color == color) &&
            (category == '' || p.category == category) &&
            avgRating(p.id) >= minRating) {
            result.push(p);
        }
    }
    renderProducts(result);
}

// Bắt sự kiện form search HTML5 Validation
var searchForm = document.getElementById('search-form');
if (searchForm) {
    searchForm.addEventListener('submit', function (e) {
        e.preventDefault();
        applyFilter();
    });
    searchForm.addEventListener('reset', function () {
        setTimeout(applyFilter, 0);
    });
}

// ===== CÂU 4: Event Delegation - Chỉ 1 listener duy nhất ở container cha =====
var prodContainer = document.getElementById('product-list');
if (prodContainer) {
    prodContainer.addEventListener('click', function (e) {
        var btn = e.target;
        if (btn.tagName != 'BUTTON') return;
        var action = btn.getAttribute('data-action');
        var id = btn.getAttribute('data-id');
        var variant = btn.getAttribute('data-variant');

        if (action == 'add') addToCart(id, variant);
        if (action == 'view') {
            var p = getProduct(id);
            alert(p.title + '\nGiá: $' + p.price + '\nMàu: ' + variant + '\nMô tả: ' + p.description);
        }
        if (action == 'rating') {
            var ul = btn.nextElementSibling;
            if (ul) ul.hidden = !ul.hidden;
        }
    });
}

// ===== CÂU 6: Quản lý State giỏ hàng bằng đối tượng JS =====
function addToCart(id, variant) {
    var found = false;
    for (var i = 0; i < cart.items.length; i++) {
        if (cart.items[i].productId == id && cart.items[i].color == variant) {
            cart.items[i].quantity++;
            found = true;
        }
    }
    if (!found) {
        var p = getProduct(id);
        cart.items.push({ productId: id, title: p.title, price: p.price, color: variant, quantity: 1 });
    }
    renderCart();
}

function renderCart() {
    var count = 0;
    var html = '<table><tr><th>Sản phẩm</th><th>Màu</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>';
    cart.total = 0;
    for (var i = 0; i < cart.items.length; i++) {
        var item = cart.items[i];
        var money = item.price * item.quantity;
        cart.total += money;
        count += item.quantity;
        html += '<tr><td>' + item.title.substring(0, 15) + '...</td><td>' + item.color + '</td><td>' + item.quantity +
            '</td><td>$' + item.price + '</td><td>$' + money.toFixed(2) + '</td></tr>';
    }
    html += '</table><p>Tổng tiền: <b>$' + cart.total.toFixed(2) + '</b></p>' +
        '<button onclick="openCheckout()">Thanh toán</button>';
    if (cart.items.length == 0) html = '<p>Giỏ hàng trống.</p>';

    var btnCart = document.getElementById('btn-cart');
    if (btnCart) btnCart.textContent = 'Giỏ hàng (' + count + ')';

    var miniCart = document.getElementById('mini-cart');
    if (miniCart) miniCart.innerHTML = html;
}

function toggleMiniCart() {
    var box = document.getElementById('mini-cart');
    if (box) box.hidden = !box.hidden;
}

// ===== CÂU 7: Form Validation Regex + Thanh toán giả lập =====
var fields = ['name', 'phone', 'email', 'address'];
var rules = {
    name: /^.{2,50}$/,
    phone: /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    address: /^.{5,100}$/
};
var messages = {
    name: 'Họ tên từ 2 đến 50 ký tự',
    phone: 'Số điện thoại không hợp lệ (VD: 0901234567)',
    email: 'Email không hợp lệ (VD: abc@gmail.com)',
    address: 'Địa chỉ từ 5 đến 100 ký tự'
};

function validateField(id) {
    var input = document.getElementById(id);
    if (!input) return true;
    var ok = rules[id].test(input.value.trim());
    var errEl = document.getElementById('err-' + id);
    if (errEl) errEl.textContent = ok ? '' : messages[id];
    return ok;
}

for (var i = 0; i < fields.length; i++) {
    var input = document.getElementById(fields[i]);
    if (input) {
        input.addEventListener('keyup', function () { validateField(this.id); });
        input.addEventListener('blur', function () { validateField(this.id); });
    }
}

function openCheckout() {
    if (cart.items.length == 0) {
        alert('Giỏ hàng trống!');
        return;
    }
    var miniCart = document.getElementById('mini-cart');
    if (miniCart) miniCart.hidden = true;
    var checkout = document.getElementById('checkout');
    if (checkout) checkout.hidden = false;
}

function closeCheckout() {
    var checkout = document.getElementById('checkout');
    if (checkout) checkout.hidden = true;
}

var checkoutForm = document.getElementById('checkout-form');
if (checkoutForm) {
    checkoutForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var allOk = true;
        for (var i = 0; i < fields.length; i++) {
            if (!validateField(fields[i])) allOk = false;
        }
        if (!allOk) return;

        var orders = JSON.parse(localStorage.getItem('orders')) || [];
        var no = orders.length + 1;
        var code = no >= 10 ? 'WEB0' + no : 'WEB00' + no;

        orders.push({
            id: code,
            date: new Date().toISOString().slice(0, 10),
            employeeId: '',
            customerId: '',
            customerName: document.getElementById('name').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            email: document.getElementById('email').value.trim(),
            address: document.getElementById('address').value.trim(),
            items: cart.items,
            total: Number(cart.total.toFixed(2))
        });

        localStorage.setItem('orders', JSON.stringify(orders));
        cart.items = [];
        renderCart();
        this.reset();
        closeCheckout();
        alert('Thanh toán thành công!');
    });
}

// ===== Đọc danh sách hóa đơn từ carts.xml + localStorage =====
async function readCarts() {
    try {
        var res = await fetch('data/carts.xml');
        var text = await res.text();
        var xmlDoc = new DOMParser().parseFromString(text, 'text/xml');
        var carts = xmlDoc.getElementsByTagName('cart');
        var result = [];

        for (var i = 0; i < carts.length; i++) {
            var c = carts[i];
            var nodes = c.getElementsByTagName('item');
            var items = [];
            for (var j = 0; j < nodes.length; j++) {
                items.push({
                    productId: getText(nodes[j], 'productId'),
                    title: getText(nodes[j], 'title'),
                    price: Number(getText(nodes[j], 'price')),
                    quantity: Number(getText(nodes[j], 'quantity')),
                    color: getText(nodes[j], 'color')
                });
            }
            result.push({
                id: getText(c, 'cartId'),
                date: getText(c, 'createdAt'),
                employeeId: getText(c, 'employeeId'),
                customerId: getText(c, 'customerId'),
                customerName: '',
                total: Number(getText(c, 'totalAmount')),
                items: items
            });
        }
        return result;
    } catch (e) {
        return [];
    }
}

async function getAllOrders() {
    var orders = await readCarts();
    var local = JSON.parse(localStorage.getItem('orders')) || [];
    return orders.concat(local);
}

function orderCustomer(o) {
    if (o.customerName != '') return o.customerName;
    return nameOf(customers, o.customerId);
}

async function loadCartsXML() {
    var box = document.getElementById('cart-list');
    try {
        var orders = await getAllOrders();
        var employees = await readJSON('data/employees.json');
        customers = await readJSON('data/customers.json');
    } catch (err) {
        box.innerHTML = 'Chưa thể tải dữ liệu hóa đơn (Cần chạy trên Live Server).';
        return;
    }

    var html = '<table><tr><th>Mã HD</th><th>Ngày tạo</th><th>Nhân viên</th><th>Khách hàng</th><th>Chi tiết hóa đơn</th><th>Tổng tiền</th></tr>';
    for (var i = 0; i < orders.length; i++) {
        var o = orders[i];
        var detail = '';
        for (var j = 0; j < o.items.length; j++) {
            var it = o.items[j];
            detail += it.title + ' (' + it.color + ') - ' + it.quantity + ' x $' + it.price + '<br>';
        }
        var emp = (o.employeeId != '') ? nameOf(employees, o.employeeId) : 'Online';
        html += '<tr><td>' + o.id + '</td><td>' + o.date + '</td><td>' + emp + '</td><td>' + orderCustomer(o) +
            '</td><td>' + detail + '</td><td>$' + o.total + '</td></tr>';
    }
    box.innerHTML = html + '</table>';
}

// ===== CÂU 8: Đăng nhập & Dashboard Admin =====
async function login() {
    var user = document.getElementById('username').value;
    var pass = document.getElementById('password').value;
    if (user == '' || pass == '') {
        alert('Vui lòng nhập tên đăng nhập và mật khẩu!');
        return;
    }
    try {
        var employees = await readJSON('data/employees.json');
    } catch (err) {
        alert('Không đọc được data/employees.json (Cần chạy trên Live Server).');
        return;
    }
    for (var i = 0; i < employees.length; i++) {
        if (employees[i].username == user && employees[i].password == pass) {
            currentEmp = employees[i];
            showDashboard();
            return;
        }
    }
    alert('Sai tài khoản hoặc mật khẩu!');
}

function logout() {
    currentEmp = null;
    document.getElementById('admin-content').innerHTML = loginForm;
}

async function showDashboard() {
    var box = document.getElementById('admin-content');
    try {
        var orders = await getAllOrders();
        customers = await readJSON('data/customers.json');
    } catch (err) {
        box.innerHTML = '<p>Không tải được dữ liệu (Cần chạy trên Live Server).</p><button onclick="logout()">Đăng xuất</button>';
        return;
    }

    var revenue = 0;
    var sold = {};
    var orderRows = '';

    for (var i = 0; i < orders.length; i++) {
        var o = orders[i];
        var qty = 0;
        revenue += o.total;
        for (var j = 0; j < o.items.length; j++) {
            var it = o.items[j];
            qty += it.quantity;
            if (sold[it.productId] == undefined) {
                sold[it.productId] = { title: it.title, quantity: 0, amount: 0 };
            }
            sold[it.productId].quantity += it.quantity;
            sold[it.productId].amount += it.price * it.quantity;
        }
        orderRows += '<tr><td>' + o.id + '</td><td>' + o.date + '</td><td>' + orderCustomer(o) +
            '</td><td>' + qty + '</td><td>$' + o.total + '</td></tr>';
    }

    var soldRows = '';
    for (var id in sold) {
        soldRows += '<tr><td>' + sold[id].title + '</td><td>' + sold[id].quantity + '</td><td>$' + sold[id].amount.toFixed(2) + '</td></tr>';
    }

    box.innerHTML = '<h3>Xin chào nhân viên: ' + currentEmp.name + ' (' + currentEmp.role + ')</h3>' +
        '<button onclick="logout()" style="margin: 10px 0;">Đăng xuất</button>' +
        '<p>Tổng số đơn hàng: <b>' + orders.length + '</b></p>' +
        '<p>Tổng doanh thu: <b>$' + revenue.toFixed(2) + '</b></p>' +
        '<h4 style="margin-top:15px;">Sản phẩm đã bán</h4>' +
        '<table><tr><th>Sản phẩm</th><th>Số lượng bán</th><th>Doanh thu</th></tr>' + soldRows + '</table>' +
        '<h4 style="margin-top:15px;">Quản lý đơn hàng</h4>' +
        '<table><tr><th>Mã đơn</th><th>Ngày</th><th>Khách hàng</th><th>Số sản phẩm</th><th>Tổng tiền</th></tr>' + orderRows + '</table>';
}

// ===== KHỞI CHẠY MẶC ĐỊNH =====
renderCart();
showSection('xml-convert'); // Đã chỉnh về tab Tải & Chuyển XML để thầy/cô bấm nút Fetch theo đúng quy trình