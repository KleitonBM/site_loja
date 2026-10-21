// ==========================================
// CONFIGURAÇÃO DO SUPABASE & SEGURANÇA
// ==========================================
const SUPABASE_URL = 'https://uhdytdulurfcpiabynad.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pPRA32kclqxN_gzfhvfREw_nAsXoaI4';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const STORE_WHATSAPP = '5527999999999'; 
const STORAGE_BUCKET = 'produtos-fotos';

// RASTREADORES DE ESTADO DE IMAGENS
let cardImageIndexes = {}; 
let currentDetailModalImages = [];
let currentDetailModalIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
    injectAlertModalHTML();

    if (document.getElementById('products-grid')) {
        loadHeroBannerFromAPI();
        loadProductsFromAPI();
        loadTrendsFromAPI(); 
        setupStorefrontFilters();
        updateWhatsappFloat();
    }

    if (document.getElementById('login-form')) {
        setupLoginForm();
    }

    if (document.getElementById('product-form')) {
        await checkAdminAuth();
        setupHeroBannerForm();  
        loadAdminProductsTable();
        loadAdminTrendsTable();
        loadAdminDebtsTable();
        loadAdminClientsTable();
        setupAdminForm();
        setupTrendsTitleForm(); 
        setupTrendForm();
        setupDebtForm();
        setupClientForm();
        setupLogout();
    }
});

// ==========================================
// UTILITÁRIO: EXTRAIR NOME DO ARQUIVO DO STORAGE
// ==========================================
function getStorageFileNameFromUrl(url) {
    if (!url) return null;
    try {
        const parts = url.split('/');
        const fullName = parts[parts.length - 1];
        return fullName.split('?')[0];
    } catch (e) {
        return null;
    }
}

// ==========================================
// SISTEMA DE POP-UP / MODAL DE ALERTA MODERNO
// ==========================================
function injectAlertModalHTML() {
    if (document.getElementById('custom-alert-modal')) return;

    const modalHtml = `
        <div id="custom-alert-modal" class="modal-overlay" style="display: none; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 99999; padding: 15px;">
            <div class="modal-card" style="background: #fff; padding: 25px; border-radius: 12px; width: 100%; max-width: 380px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                <div id="custom-alert-icon" style="font-size: 2.3rem; margin-bottom: 12px;"></div>
                <h3 id="custom-alert-title" style="margin-bottom: 8px; font-size: 1.2rem; color: #333;">Atenção</h3>
                <p id="custom-alert-message" style="margin-bottom: 20px; color: #666; font-size: 0.9rem; line-height: 1.4;"></p>
                <button type="button" onclick="closeCustomAlert()" class="btn-primary" style="width: 100%; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: 600;">OK</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

window.showCustomAlert = function(message, title = 'Aviso', type = 'info') {
    const modal = document.getElementById('custom-alert-modal');
    const titleEl = document.getElementById('custom-alert-title');
    const msgEl = document.getElementById('custom-alert-message');
    const iconEl = document.getElementById('custom-alert-icon');

    if (!modal) { alert(message); return; }

    titleEl.innerText = title;
    msgEl.innerText = message;

    if (type === 'success') {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color: #20ba5a;"></i>';
    } else if (type === 'error') {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="color: #d9534f;"></i>';
    } else {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-info" style="color: #6c63ff;"></i>';
    }
    modal.style.display = 'flex';
}

window.closeCustomAlert = function() {
    const modal = document.getElementById('custom-alert-modal');
    if (modal) modal.style.display = 'none';
}

// ==========================================
// CONTROLE DOS MODAIS DO PAINEL ADM
// ==========================================
window.openProductModal = function(isEdit = false) {
    const modal = document.getElementById('product-modal');
    if (!isEdit) resetAdminForm();
    if (modal) modal.classList.add('open');
}

window.closeProductModal = function() {
    const modal = document.getElementById('product-modal');
    if (modal) modal.classList.remove('open');
}

window.openTrendModal = function() {
    const form = document.getElementById('trend-form');
    if (form) form.reset();
    const modal = document.getElementById('trend-modal');
    if (modal) modal.classList.add('open');
}

window.closeTrendModal = function() {
    const modal = document.getElementById('trend-modal');
    if (modal) modal.classList.remove('open');
}

// ==========================================
// 1. CARREGAR HERO BANNER DINÂMICO
// ==========================================
async function loadHeroBannerFromAPI() {
    const heroSection = document.querySelector('.hero-banner');
    const subtitleEl = document.querySelector('.hero-subtitle');
    const titleEl = document.querySelector('.hero-banner h2');
    const descEl = document.querySelector('.hero-banner p');

    if (!heroSection) return;

    try {
        const { data } = await supabaseClient.from('store_settings').select('*').eq('id', 'main').single();
        if (data) {
            if (data.hero_subtitle && subtitleEl) subtitleEl.innerText = data.hero_subtitle;
            if (data.hero_title && titleEl) titleEl.innerText = data.hero_title;
            if (data.hero_description && descEl) descEl.innerText = data.hero_description;
            if (data.hero_bg_url) {
                heroSection.style.background = `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url('${data.hero_bg_url}') center/cover no-repeat`;
            }
        }
    } catch (err) {
        console.error('Erro ao carregar Hero Banner:', err);
    }
}

// ==========================================
// 2. VITRINE (index.html)
// ==========================================
let allProducts = [];

async function loadProductsFromAPI() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #777;">Buscando lançamentos da API...</p>';

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/produtos?select=*&order=created_at.desc`, {
            method: 'GET',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });

        if (!response.ok) throw new Error('Erro ao conectar com a API');
        allProducts = await response.json();
        renderProducts(allProducts);
    } catch (error) {
        console.error(error);
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #d9534f;">Não foi possível carregar os produtos.</p>';
    }
}

function renderProducts(products) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!products || products.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #777; padding: 40px;">Nenhuma peça disponível na vitrine no momento.</p>';
        return;
    }

    products.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'product-card';

        let prodImages = [];
        if (Array.isArray(prod.images) && prod.images.length > 0) {
            prodImages = prod.images;
        } else if (typeof prod.images === 'string') {
            try { prodImages = JSON.parse(prod.images); } catch(e) { prodImages = [prod.image_url]; }
        } else {
            prodImages = prod.image_url ? [prod.image_url] : ['https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80'];
        }

        cardImageIndexes[prod.id] = 0;
        const mainImage = prodImages[0];
        const sizes = Array.isArray(prod.sizes) ? prod.sizes : (prod.sizes ? prod.sizes.split(',') : ['P', 'M', 'G']);
        const sizesHtml = sizes.map(s => `<span class="size-pill">${s.trim()}</span>`).join('');
        const oldPriceHtml = prod.old_price ? `<span class="price-old">R$ ${Number(prod.old_price).toFixed(2)}</span>` : '';
        const badgeHtml = prod.old_price ? `<span class="card-badge">Oferta</span>` : '';

        const arrowsHtml = prodImages.length > 1 ? `
            <button type="button" class="card-nav-btn prev" onclick="event.stopPropagation(); changeCardImage('${prod.id}', -1)"><i class="fa-solid fa-chevron-left"></i></button>
            <button type="button" class="card-nav-btn next" onclick="event.stopPropagation(); changeCardImage('${prod.id}', 1)"><i class="fa-solid fa-chevron-right"></i></button>
        ` : '';

        card.onclick = () => openProductDetailModal(prod);
        card.innerHTML = `
            <div class="card-img-wrapper">
                <img id="card-img-${prod.id}" src="${mainImage}" alt="${escapeHtml(prod.name)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80'">
                ${arrowsHtml}
                ${badgeHtml}
            </div>
            <div class="card-details">
                <span class="card-category">${escapeHtml(prod.category)}</span>
                <h3 class="card-title">${escapeHtml(prod.name)}</h3>
                <div class="card-pricing">
                    <span class="price-current">R$ ${Number(prod.price).toFixed(2)}</span>
                    ${oldPriceHtml}
                </div>
                <div class="sizes-row">${sizesHtml}</div>
                <button type="button" onclick="event.stopPropagation(); reserveFromCard('${prod.id}', '${escapeHtml(prod.name)}', ${prod.price}, '${escapeHtml(sizes.join(','))}')" class="btn-reservar-card">
                    <i class="fa-solid fa-bookmark"></i> Reservar Peça
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

window.changeCardImage = function(prodId, direction) {
    const prod = allProducts.find(p => p.id === prodId);
    if (!prod) return;

    let prodImages = [];
    if (Array.isArray(prod.images) && prod.images.length > 0) {
        prodImages = prod.images;
    } else if (typeof prod.images === 'string') {
        try { prodImages = JSON.parse(prod.images); } catch(e) { prodImages = [prod.image_url]; }
    } else {
        prodImages = [prod.image_url];
    }

    if (prodImages.length <= 1) return;

    let currentIndex = cardImageIndexes[prodId] || 0;
    currentIndex += direction;

    if (currentIndex < 0) currentIndex = prodImages.length - 1;
    if (currentIndex >= prodImages.length) currentIndex = 0;

    cardImageIndexes[prodId] = currentIndex;
    
    const imgEl = document.getElementById(`card-img-${prodId}`);
    if (imgEl) {
        imgEl.style.opacity = '0.3';
        setTimeout(() => {
            imgEl.src = prodImages[currentIndex];
            imgEl.style.opacity = '1';
        }, 100);
    }
}

window.reserveFromCard = function(prodId, name, price, sizesStr) {
    const prod = allProducts.find(p => p.id === prodId);
    let selectedImage = '';

    if (prod) {
        let prodImages = [];
        if (Array.isArray(prod.images) && prod.images.length > 0) {
            prodImages = prod.images;
        } else if (typeof prod.images === 'string') {
            try { prodImages = JSON.parse(prod.images); } catch(e) { prodImages = [prod.image_url]; }
        } else {
            prodImages = [prod.image_url];
        }

        const currentIdx = cardImageIndexes[prodId] || 0;
        selectedImage = prodImages[currentIdx] || prod.image_url;
    }

    openReservationModal(name, price, sizesStr, selectedImage);
}

window.openProductDetailModal = function(prod) {
    const modal = document.getElementById('product-detail-modal');
    if (!modal) return;

    if (Array.isArray(prod.images) && prod.images.length > 0) {
        currentDetailModalImages = prod.images;
    } else if (typeof prod.images === 'string') {
        try { currentDetailModalImages = JSON.parse(prod.images); } catch(e) { currentDetailModalImages = [prod.image_url]; }
    } else {
        currentDetailModalImages = [prod.image_url];
    }

    currentDetailModalIndex = 0;
    const sizes = Array.isArray(prod.sizes) ? prod.sizes : (prod.sizes ? prod.sizes.split(',') : ['P', 'M', 'G']);

    document.getElementById('detail-category').innerText = prod.category;
    document.getElementById('detail-title').innerText = prod.name;
    document.getElementById('detail-price-current').innerText = `R$ ${Number(prod.price).toFixed(2)}`;
    document.getElementById('detail-price-old').innerText = prod.old_price ? `R$ ${Number(prod.old_price).toFixed(2)}` : '';
    document.getElementById('detail-description').innerText = prod.description || 'Sem descrição cadastrada.';

    const sizesRow = document.getElementById('detail-sizes-row');
    sizesRow.innerHTML = sizes.map(s => `<span class="size-pill">${s.trim()}</span>`).join('');

    updateModalMainImage();

    const prevBtn = document.getElementById('modal-img-prev');
    const nextBtn = document.getElementById('modal-img-next');

    if (currentDetailModalImages.length > 1) {
        if (prevBtn) prevBtn.style.display = 'flex';
        if (nextBtn) nextBtn.style.display = 'flex';
        
        prevBtn.onclick = () => {
            currentDetailModalIndex = (currentDetailModalIndex - 1 + currentDetailModalImages.length) % currentDetailModalImages.length;
            updateModalMainImage();
        };
        nextBtn.onclick = () => {
            currentDetailModalIndex = (currentDetailModalIndex + 1) % currentDetailModalImages.length;
            updateModalMainImage();
        };
    } else {
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    }

    const resBtn = document.getElementById('btn-open-res-from-detail');
    resBtn.onclick = () => {
        const currentlyViewedImg = currentDetailModalImages[currentDetailModalIndex];
        closeProductDetailModal();
        openReservationModal(prod.name, prod.price, sizes.join(','), currentlyViewedImg);
    };

    modal.classList.add('open');
}

function updateModalMainImage() {
    const mainImg = document.getElementById('detail-main-img');
    const thumbsGrid = document.getElementById('detail-thumbs-grid');
    
    if (mainImg) mainImg.src = currentDetailModalImages[currentDetailModalIndex];

    if (thumbsGrid) {
        thumbsGrid.innerHTML = '';
        currentDetailModalImages.forEach((imgUrl, index) => {
            const thumb = document.createElement('img');
            thumb.src = imgUrl;
            thumb.className = `thumb-img ${index === currentDetailModalIndex ? 'active' : ''}`;
            thumb.onclick = () => {
                currentDetailModalIndex = index;
                updateModalMainImage();
            };
            thumbsGrid.appendChild(thumb);
        });
    }
}

window.closeProductDetailModal = function() {
    const modal = document.getElementById('product-detail-modal');
    if (modal) modal.classList.remove('open');
}

function setupStorefrontFilters() {
    const searchInput = document.getElementById('input-search');
    const categoryButtons = document.querySelectorAll('.pill-btn');
    let debounceTimer;

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const term = e.target.value.toLowerCase();
                const filtered = allProducts.filter(p => 
                    p.name.toLowerCase().includes(term) || 
                    p.category.toLowerCase().includes(term)
                );
                renderProducts(filtered);
            }, 300);
        });
    }

    categoryButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            categoryButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            const cat = e.target.getAttribute('data-category');
            if (cat === 'todos') {
                renderProducts(allProducts);
            } else {
                renderProducts(allProducts.filter(p => p.category === cat));
            }
        });
    });
}

function updateWhatsappFloat() {
    const floatBtn = document.getElementById('floating-whatsapp');
    if (floatBtn) {
        const defaultMsg = encodeURIComponent("Olá! Vim pelo site da loja e gostaria de atendimento.");
        floatBtn.href = `https://wa.me/${STORE_WHATSAPP}?text=${defaultMsg}`;
    }
}

async function loadTrendsFromAPI() {
    const trendsGrid = document.querySelector('.trends-grid');
    const trendsTitleElement = document.querySelector('.trends-section h3');
    if (!trendsGrid) return;

    try {
        const { data: settingsData } = await supabaseClient.from('store_settings').select('trends_title').eq('id', 'main').single();
        if (settingsData && trendsTitleElement) trendsTitleElement.innerText = settingsData.trends_title;

        const response = await fetch(`${SUPABASE_URL}/rest/v1/tendencias?select=*&order=created_at.desc&limit=5`, {
            method: 'GET',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (!response.ok) return;

        const trends = await response.json();
        if (!trends || trends.length === 0) return;

        trendsGrid.innerHTML = '';
        trends.forEach(trend => {
            const card = document.createElement('div');
            card.className = 'trend-card';
            card.innerHTML = `
                <img src="${trend.image_url}" alt="${escapeHtml(trend.title)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80'">
                <div class="trend-overlay">
                    <span>${escapeHtml(trend.tag)}</span>
                    <h4>${escapeHtml(trend.title)}</h4>
                </div>
            `;
            trendsGrid.appendChild(card);
        });
    } catch (err) {
        console.error('Erro ao carregar tendências:', err);
    }
}

// ==========================================
// 3. AUTENTICAÇÃO
// ==========================================
function setupLoginForm() {
    const form = document.getElementById('login-form');
    const errorDiv = document.getElementById('login-error');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.style.display = 'none';

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            errorDiv.innerText = "E-mail ou senha incorretos.";
            errorDiv.style.display = 'block';
        } else {
            window.location.href = 'admin.html';
        }
    });
}

async function checkAdminAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) window.location.href = 'login.html';
}

function setupLogout() {
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.href = 'login.html';
        });
    }
}

// ==========================================
// 4. HERO BANNER ADMIN COM MINIATURA E REMOÇÃO
// ==========================================
function setupHeroBannerForm() {
    const form = document.getElementById('hero-banner-form');
    const subtitleInput = document.getElementById('hero-subtitle-input');
    const titleInput = document.getElementById('hero-title-input');
    const descInput = document.getElementById('hero-desc-input');
    const bgFileInput = document.getElementById('hero-bg-file');
    const thumbContainer = document.getElementById('hero-bg-thumb-container');

    if (!form) return;

    let currentBgUrl = '';

    function renderHeroThumb(url) {
        if (!thumbContainer) return;
        if (!url) {
            thumbContainer.innerHTML = '<span style="font-size: 0.8rem; color: #777;">Nenhuma foto de fundo cadastrada.</span>';
            return;
        }
        thumbContainer.innerHTML = `
            <div style="position: relative; width: 100px; height: 60px; border-radius: 6px; overflow: hidden; border: 1px solid #ddd;">
                <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;">
                <button type="button" onclick="removeHeroBackground()" title="Excluir foto de fundo" style="position: absolute; top: 2px; right: 2px; background: rgba(217, 83, 79, 0.9); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 0.7rem; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;
    }

    window.removeHeroBackground = async function() {
        if (confirm('Deseja excluir a imagem de fundo atual do Banner?')) {
            if (currentBgUrl) {
                const oldFileName = getStorageFileNameFromUrl(currentBgUrl);
                if (oldFileName) await supabaseClient.storage.from(STORAGE_BUCKET).remove([oldFileName]);
            }
            await supabaseClient.from('store_settings').update({ hero_bg_url: null }).eq('id', 'main');
            currentBgUrl = '';
            renderHeroThumb('');
            showCustomAlert('Imagem de fundo removida com sucesso!', 'Sucesso', 'success');
        }
    };

    supabaseClient.from('store_settings').select('*').eq('id', 'main').single()
        .then(({ data }) => {
            if (data) {
                if (data.hero_subtitle) subtitleInput.value = data.hero_subtitle;
                if (data.hero_title) titleInput.value = data.hero_title;
                if (data.hero_description) descInput.value = data.hero_description;
                if (data.hero_bg_url) {
                    currentBgUrl = data.hero_bg_url;
                    renderHeroThumb(currentBgUrl);
                } else {
                    renderHeroThumb('');
                }
            }
        });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-hero');
        btn.innerText = 'Salvando alterações...';
        btn.disabled = true;

        const hero_subtitle = subtitleInput.value;
        const hero_title = titleInput.value;
        const hero_description = descInput.value;
        let payload = { id: 'main', hero_subtitle, hero_title, hero_description };

        if (bgFileInput.files && bgFileInput.files[0]) {
            const file = bgFileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `hero_bg_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabaseClient.storage.from(STORAGE_BUCKET).upload(fileName, file);
            if (uploadError) {
                showCustomAlert('Erro ao enviar imagem: ' + uploadError.message, 'Erro', 'error');
                btn.innerText = 'Salvar Alterações do Banner';
                btn.disabled = false;
                return;
            }

            const { data: publicURLData } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
            payload.hero_bg_url = publicURLData.publicUrl;

            if (currentBgUrl) {
                const oldFileName = getStorageFileNameFromUrl(currentBgUrl);
                if (oldFileName) await supabaseClient.storage.from(STORAGE_BUCKET).remove([oldFileName]);
            }
            currentBgUrl = payload.hero_bg_url;
            renderHeroThumb(currentBgUrl);
        }

        const { error } = await supabaseClient.from('store_settings').upsert(payload);
        if (error) {
            showCustomAlert('Erro ao salvar Banner: ' + error.message, 'Erro', 'error');
        } else {
            showCustomAlert('Banner principal atualizado com sucesso!', 'Sucesso', 'success');
        }
        btn.innerText = 'Salvar Alterações do Banner';
        btn.disabled = false;
    });
}

// ==========================================
// 5. PRODUTOS NO ADM COM MINIATURAS E EXCLUSÃO
// ==========================================
async function loadAdminProductsTable() {
    const tableBody = document.getElementById('admin-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #777;">Carregando registros...</td></tr>';

    const { data, error } = await supabaseClient.from('produtos').select('*').order('created_at', { ascending: false });
    if (error) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #d9534f;">Erro ao carregar dados.</td></tr>';
        return;
    }

    tableBody.innerHTML = '';
    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #777;">Nenhum produto cadastrado.</td></tr>';
        return;
    }

    data.forEach(prod => {
        const prodImages = (prod.images && prod.images.length > 0) ? prod.images : [prod.image_url];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${prodImages[0]}" width="40" height="40" style="object-fit:cover; border-radius:4px;" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=100&q=80'"></td>
            <td><strong>${escapeHtml(prod.name)}</strong></td>
            <td>${escapeHtml(prod.category)}</td>
            <td>R$ ${Number(prod.price).toFixed(2)}</td>
            <td>
                <button class="action-icon-btn edit" onclick="prepareEdit('${prod.id}', '${escapeHtml(prod.name)}', ${prod.price}, ${prod.old_price || 'null'}, '${escapeHtml(prod.category)}', '${escapeHtml(prod.description || '')}')"><i class="fa-solid fa-pen"></i></button>
                <button class="action-icon-btn delete" onclick="deleteProduct('${prod.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function renderAdminProductThumbs(imagesArray) {
    const container = document.getElementById('admin-product-thumbs-container');
    if (!container) return;

    container.innerHTML = '';
    if (!imagesArray || imagesArray.length === 0) {
        container.innerHTML = '<span style="font-size: 0.8rem; color: #777;">Nenhuma foto adicionada ainda.</span>';
        return;
    }

    imagesArray.forEach((imgUrl, index) => {
        const thumbWrapper = document.createElement('div');
        thumbWrapper.style.cssText = 'position: relative; width: 60px; height: 60px; border-radius: 6px; overflow: hidden; border: 1px solid #ddd; background: #f9f9f9;';
        thumbWrapper.innerHTML = `
            <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=100&q=80'">
            <button type="button" onclick="removeProductImageByIndex(${index})" title="Excluir esta foto" style="position: absolute; top: 2px; right: 2px; background: rgba(217, 83, 79, 0.9); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 0.7rem; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i class="fa-solid fa-xmark"></i></button>
        `;
        container.appendChild(thumbWrapper);
    });
}

window.removeProductImageByIndex = async function(index) {
    const hiddenInput = document.getElementById('prod-images-current');
    if (!hiddenInput) return;

    let images = [];
    try { images = JSON.parse(hiddenInput.value); } catch(e) { images = []; }

    const removedUrl = images[index];
    images.splice(index, 1);
    hiddenInput.value = JSON.stringify(images);
    renderAdminProductThumbs(images);

    if (removedUrl) {
        const fileName = getStorageFileNameFromUrl(removedUrl);
        if (fileName) {
            await supabaseClient.storage.from(STORAGE_BUCKET).remove([fileName]);
        }
    }
}

function setupAdminForm() {
    const form = document.getElementById('product-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-submit');
        submitBtn.innerText = 'Enviando fotos e salvando...';
        submitBtn.disabled = true;

        const id = document.getElementById('prod-id').value;
        const name = document.getElementById('prod-name').value;
        const price = parseFloat(document.getElementById('prod-price').value);
        const oldPriceVal = document.getElementById('prod-old-price').value;
        const old_price = oldPriceVal ? parseFloat(oldPriceVal) : null;
        const category = document.getElementById('prod-category').value;
        const sizesInput = document.getElementById('prod-sizes').value;
        const sizes = sizesInput.split(',').map(s => s.trim()).filter(Boolean);
        const description = document.getElementById('prod-desc').value;
        const fileInput = document.getElementById('prod-file');

        let images = [];
        if (document.getElementById('prod-images-current') && document.getElementById('prod-images-current').value) {
            try { images = JSON.parse(document.getElementById('prod-images-current').value); } catch(e) { images = []; }
        }

        if (fileInput.files && fileInput.files.length > 0) {
            for (let i = 0; i < fileInput.files.length; i++) {
                const file = fileInput.files[i];
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

                const { error: uploadError } = await supabaseClient.storage.from(STORAGE_BUCKET).upload(fileName, file);
                if (!uploadError) {
                    const { data: publicURLData } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
                    images.push(publicURLData.publicUrl);
                }
            }
        }

        if (images.length === 0) {
            showCustomAlert('Por favor, selecione ao menos uma foto do produto.', 'Aviso', 'info');
            submitBtn.innerText = 'Salvar Produto no Banco de Dados';
            submitBtn.disabled = false;
            return;
        }

        const payload = { name, price, old_price, category, sizes, image_url: images[0], images, description };

        if (id) {
            const { error } = await supabaseClient.from('produtos').update(payload).eq('id', id);
            if (error) showCustomAlert('Erro ao atualizar: ' + error.message, 'Erro', 'error');
            else { showCustomAlert('Produto atualizado!', 'Sucesso', 'success'); resetAdminForm(); loadAdminProductsTable(); closeProductModal(); }
        } else {
            const { error } = await supabaseClient.from('produtos').insert([payload]);
            if (error) showCustomAlert('Erro ao cadastrar: ' + error.message, 'Erro', 'error');
            else { showCustomAlert('Produto cadastrado!', 'Sucesso', 'success'); resetAdminForm(); loadAdminProductsTable(); closeProductModal(); }
        }

        submitBtn.innerText = 'Salvar Produto no Banco de Dados';
        submitBtn.disabled = false;
    });
}

window.prepareEdit = async function(id, name, price, oldPrice, category, description) {
    document.getElementById('form-title').innerText = 'Editar Produto';
    document.getElementById('prod-id').value = id;
    document.getElementById('prod-name').value = name;
    document.getElementById('prod-price').value = price;
    document.getElementById('prod-old-price').value = (oldPrice && oldPrice !== 'null') ? oldPrice : '';
    document.getElementById('prod-category').value = category;
    document.getElementById('prod-desc').value = description;

    const { data } = await supabaseClient.from('produtos').select('images, image_url').eq('id', id).single();
    let images = (data && data.images && data.images.length > 0) ? data.images : (data?.image_url ? [data.image_url] : []);

    let hiddenInput = document.getElementById('prod-images-current');
    if (!hiddenInput) {
        hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.id = 'prod-images-current';
        document.getElementById('product-form').appendChild(hiddenInput);
    }
    hiddenInput.value = JSON.stringify(images);
    renderAdminProductThumbs(images);

    document.getElementById('btn-submit').innerText = 'Atualizar Alterações';
    openProductModal(true);
}

window.deleteProduct = async function(id) {
    if (confirm('Tem certeza que deseja remover este produto e suas fotos do servidor?')) {
        const { data: prodData } = await supabaseClient.from('produtos').select('images, image_url').eq('id', id).single();
        const { error } = await supabaseClient.from('produtos').delete().eq('id', id);
        
        if (error) {
            showCustomAlert('Erro ao excluir: ' + error.message, 'Erro', 'error');
        } else {
            if (prodData) {
                const imagesList = (prodData.images && prodData.images.length > 0) ? prodData.images : [prodData.image_url];
                const filesToRemove = imagesList.map(url => getStorageFileNameFromUrl(url)).filter(Boolean);
                if (filesToRemove.length > 0) {
                    await supabaseClient.storage.from(STORAGE_BUCKET).remove(filesToRemove);
                }
            }
            showCustomAlert('Produto e arquivos removidos com sucesso!', 'Sucesso', 'success');
            loadAdminProductsTable();
        }
    }
}

function resetAdminForm() {
    const form = document.getElementById('product-form');
    if (form) form.reset();
    const prodId = document.getElementById('prod-id');
    if (prodId) prodId.value = '';
    const hiddenInput = document.getElementById('prod-images-current');
    if (hiddenInput) hiddenInput.value = '';
    const thumbsContainer = document.getElementById('admin-product-thumbs-container');
    if (thumbsContainer) thumbsContainer.innerHTML = '<span style="font-size: 0.8rem; color: #777;">Nenhuma foto adicionada ainda.</span>';
    const formTitle = document.getElementById('form-title');
    if (formTitle) formTitle.innerText = 'Cadastrar Novo Produto';
    const submitBtn = document.getElementById('btn-submit');
    if (submitBtn) submitBtn.innerText = 'Salvar Produto no Banco de Dados';
}

// ==========================================
// 6. TENDÊNCIAS COM MINIATURA E EXCLUSÃO
// ==========================================
function setupTrendsTitleForm() {
    const form = document.getElementById('trends-title-form');
    const inputTitle = document.getElementById('trends-main-title');
    if (!form || !inputTitle) return;

    supabaseClient.from('store_settings').select('trends_title').eq('id', 'main').single()
        .then(({ data }) => { if (data && data.trends_title) inputTitle.value = data.trends_title; });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newTitle = inputTitle.value;
        const { error } = await supabaseClient.from('store_settings').upsert({ id: 'main', trends_title: newTitle });
        if (error) showCustomAlert('Erro ao atualizar título: ' + error.message, 'Erro', 'error');
        else showCustomAlert('Título atualizado com sucesso!', 'Sucesso', 'success');
    });
}

async function loadAdminTrendsTable() {
    const tbody = document.getElementById('admin-trends-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Carregando tendências...</td></tr>';

    const { data, error } = await supabaseClient.from('tendencias').select('*').order('created_at', { ascending: false });
    if (error || !data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhuma tendência cadastrada.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach((trend, index) => {
        const isLimitWarning = index >= 5 ? ' <small style="color:#d9534f;">(Oculto no site - Limite de 5)</small>' : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${trend.image_url}" width="40" height="40" style="object-fit:cover; border-radius:4px;" loading="lazy"></td>
            <td><span class="size-pill">${escapeHtml(trend.tag)}</span></td>
            <td><strong>${escapeHtml(trend.title)}</strong>${isLimitWarning}</td>
            <td>
                <button class="action-icon-btn edit" onclick="prepareEditTrend('${trend.id}', '${escapeHtml(trend.tag)}', '${escapeHtml(trend.title)}', '${trend.image_url}')"><i class="fa-solid fa-pen"></i></button>
                <button class="action-icon-btn delete" onclick="deleteTrend('${trend.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.prepareEditTrend = function(id, tag, title, imageUrl) {
    document.getElementById('trend-form-title').innerText = 'Editar Card de Tendência';
    document.getElementById('trend-id').value = id;
    document.getElementById('trend-tag').value = tag;
    document.getElementById('trend-title').value = title;

    let hiddenInput = document.getElementById('trend-current-img');
    if (!hiddenInput) {
        hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.id = 'trend-current-img';
        document.getElementById('trend-form').appendChild(hiddenInput);
    }
    hiddenInput.value = imageUrl;

    const thumbContainer = document.getElementById('admin-trend-thumb-container');
    if (thumbContainer) {
        thumbContainer.innerHTML = `
            <div style="position: relative; width: 80px; height: 60px; border-radius: 6px; overflow: hidden; border: 1px solid #ddd;">
                <img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
        `;
    }

    document.getElementById('btn-submit-trend').innerText = 'Atualizar Tendência';
    document.getElementById('trend-modal').classList.add('open');
}

function setupTrendForm() {
    const form = document.getElementById('trend-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-trend');
        const id = document.getElementById('trend-id').value;
        const tag = document.getElementById('trend-tag').value;
        const title = document.getElementById('trend-title').value;
        const fileInput = document.getElementById('trend-file');

        let image_url = document.getElementById('trend-current-img')?.value || '';

        if (!id) {
            const { count } = await supabaseClient.from('tendencias').select('*', { count: 'exact', head: true });
            if (count >= 5) {
                if (!confirm('Você já possui 5 tendências ativas. Caso cadastre uma nova, a mais antiga deixará de aparecer. Deseja continuar?')) return;
            }
        }

        if (fileInput.files && fileInput.files[0]) {
            btn.innerText = 'Enviando foto...';
            btn.disabled = true;

            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `trend_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabaseClient.storage.from(STORAGE_BUCKET).upload(fileName, file);
            if (uploadError) {
                showCustomAlert('Erro no upload: ' + uploadError.message, 'Erro', 'error');
                btn.innerText = id ? 'Atualizar Tendência' : 'Adicionar Tendência';
                btn.disabled = false;
                return;
            }

            const { data: publicURLData } = await supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
            
            if (image_url) {
                const oldName = getStorageFileNameFromUrl(image_url);
                if (oldName) await supabaseClient.storage.from(STORAGE_BUCKET).remove([oldName]);
            }
            image_url = publicURLData.publicUrl;
        }

        if (!image_url) {
            showCustomAlert('Por favor, selecione uma foto para a tendência.', 'Aviso', 'info');
            btn.innerText = id ? 'Atualizar Tendência' : 'Adicionar Tendência';
            btn.disabled = false;
            return;
        }

        const payload = { tag, title, image_url };
        let error;

        if (id) {
            const res = await supabaseClient.from('tendencias').update(payload).eq('id', id);
            error = res.error;
        } else {
            const res = await supabaseClient.from('tendencias').insert([payload]);
            error = res.error;
        }

        if (error) {
            showCustomAlert('Erro ao salvar: ' + error.message, 'Erro', 'error');
        } else {
            showCustomAlert('Tendência salva com sucesso!', 'Sucesso', 'success');
            form.reset();
            loadAdminTrendsTable();
            closeTrendModal();
        }
        btn.innerText = 'Adicionar Tendência';
        btn.disabled = false;
    });
}

window.deleteTrend = async function(id) {
    if (confirm('Deseja realmente remover esta tendência?')) {
        const { data: trendData } = await supabaseClient.from('tendencias').select('image_url').eq('id', id).single();
        const { error } = await supabaseClient.from('tendencias').delete().eq('id', id);
        
        if (error) {
            showCustomAlert('Erro ao excluir: ' + error.message, 'Erro', 'error');
        } else {
            if (trendData && trendData.image_url) {
                const fileName = getStorageFileNameFromUrl(trendData.image_url);
                if (fileName) await supabaseClient.storage.from(STORAGE_BUCKET).remove([fileName]);
            }
            showCustomAlert('Tendência removida com sucesso!', 'Sucesso', 'success');
            loadAdminTrendsTable();
        }
    }
}

// ==========================================
// 7. DÍVIDAS / CADERNETA
// ==========================================
let availableStoreProducts = [];

async function populateDebtDropdowns() {
    const clientSelect = document.getElementById('debt-client-select');
    if (clientSelect) {
        clientSelect.innerHTML = '<option value="">Carregando clientes...</option>';
        const { data: clients } = await supabaseClient.from('clientes').select('name').order('name', { ascending: true });
        clientSelect.innerHTML = '<option value="">Selecione uma cliente...</option>';
        (clients || []).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = c.name;
            clientSelect.appendChild(opt);
        });
    }

    const { data: products } = await supabaseClient.from('produtos').select('name, price').order('name', { ascending: true });
    availableStoreProducts = products || [];

    const container = document.getElementById('debt-items-container');
    if (container) {
        container.innerHTML = '';
        addDebtItemRow();
    }
}

window.addDebtItemRow = function() {
    const container = document.getElementById('debt-items-container');
    if (!container) return;

    const rowId = 'item_row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
    const row = document.createElement('div');
    row.className = 'debt-item-row';
    row.id = rowId;
    row.style.cssText = 'display: grid; grid-template-columns: 1fr 130px 40px; gap: 8px; align-items: center; width: 100%; padding: 10px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 6px; margin-bottom: 8px;';

    let productOptions = '<option value="">-- Selecionar da Vitrine (Opcional) --</option>';
    availableStoreProducts.forEach(p => {
        productOptions += `<option value="${escapeHtml(p.name)}" data-price="${p.price}">${escapeHtml(p.name)} (R$ ${Number(p.price).toFixed(2)})</option>`;
    });

    row.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 6px;">
            <select class="debt-product-choice" onchange="handleDebtProductSelect(this)" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: #fff; font-size: 0.85rem;">
                ${productOptions}
            </select>
            <input type="text" class="debt-product-manual" placeholder="Ou digite o nome da peça/serviço..." style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: #fff; font-size: 0.85rem;">
        </div>
        <div>
            <input type="number" step="0.01" class="debt-product-price" placeholder="Valor (R$)" oninput="updateDebtTotal()" required style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: #fff; font-size: 0.85rem; width: 100%;">
        </div>
        <div style="text-align: center;">
            <button type="button" class="action-icon-btn delete" onclick="removeDebtItemRow('${rowId}')" title="Remover item" style="margin: 0; padding: 8px;"><i class="fa-solid fa-trash"></i></button>
        </div>
    `;
    container.appendChild(row);
}

window.handleDebtProductSelect = function(selectEl) {
    const row = selectEl.closest('.debt-item-row');
    if (!row) return;

    const priceEl = row.querySelector('.debt-product-price');
    const manualInput = row.querySelector('.debt-product-manual');
    const selectedOpt = selectEl.options[selectEl.selectedIndex];

    if (selectEl.value) {
        manualInput.value = selectEl.value;
        const price = selectedOpt.getAttribute('data-price');
        if (price) priceEl.value = price;
    }
    updateDebtTotal();
}

window.removeDebtItemRow = function(rowId) {
    const row = document.getElementById(rowId);
    if (row) { row.remove(); updateDebtTotal(); }
}

window.updateDebtTotal = function() {
    const priceInputs = document.querySelectorAll('.debt-product-price');
    let total = 0;
    priceInputs.forEach(input => { total += parseFloat(input.value) || 0; });
    const totalEl = document.getElementById('debt-total-calculated');
    if (totalEl) totalEl.innerText = `R$ ${total.toFixed(2)}`;
}

window.openDebtModal = function() {
    const form = document.getElementById('debt-form');
    if (form) form.reset();
    
    const todayStr = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('debt-date');
    if (dateInput) dateInput.value = todayStr;

    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
    const dueDateInput = document.getElementById('debt-due-date');
    if (dueDateInput) dueDateInput.value = thirtyDaysAhead.toISOString().split('T')[0];
    
    populateDebtDropdowns();
    const modal = document.getElementById('debt-modal');
    if (modal) modal.classList.add('open');
}

window.closeDebtModal = function() {
    const modal = document.getElementById('debt-modal');
    if (modal) modal.classList.remove('open');
}

window.resetDebtFilters = function() {
    const statusEl = document.getElementById('filter-debt-status');
    const clientEl = document.getElementById('filter-debt-client');
    const productEl = document.getElementById('filter-debt-product');
    if (statusEl) statusEl.value = 'pendente';
    if (clientEl) clientEl.value = '';
    if (productEl) productEl.value = '';
    loadAdminDebtsTable();
}

async function loadAdminDebtsTable() {
    const tbody = document.getElementById('admin-debts-table-body');
    const totalSumEl = document.getElementById('total-debt-sum');
    const statusFilter = document.getElementById('filter-debt-status')?.value || 'pendente';
    const clientQuery = document.getElementById('filter-debt-client')?.value.toLowerCase().trim() || '';
    const productQuery = document.getElementById('filter-debt-product')?.value.toLowerCase().trim() || '';

    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Carregando caderneta...</td></tr>';

    const { data, error } = await supabaseClient.from('clientes_dividas').select('*').order('purchase_date', { ascending: false });
    if (error || !data) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #d9534f;">Erro ao carregar dados.</td></tr>';
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #777;">Nenhum registro na caderneta.</td></tr>';
        if (totalSumEl) totalSumEl.innerText = 'R$ 0,00';
        return;
    }

    tbody.innerHTML = '';
    let totalPendingSum = 0;
    const today = new Date();
    today.setHours(0,0,0,0);

    const filteredData = data.filter(item => {
        const isPaid = item.is_paid;
        const dueDate = new Date((item.due_date || item.purchase_date) + 'T00:00:00');
        const isDelayed = !isPaid && dueDate < today;

        if (statusFilter === 'pendente' && isPaid) return false;
        if (statusFilter === 'atrasado' && !isDelayed) return false;
        if (statusFilter === 'pago' && !isPaid) return false;
        if (clientQuery && !item.client_name.toLowerCase().includes(clientQuery)) return false;
        if (productQuery && !item.product_name.toLowerCase().includes(productQuery)) return false;
        return true;
    });

    data.forEach(item => {
        if (!item.is_paid) totalPendingSum += Number(item.total_price);
    });

    if (totalSumEl) totalSumEl.innerText = `R$ ${totalPendingSum.toFixed(2)}`;

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: #777; padding: 30px;">Nenhum registro encontrado.</td></tr>`;
        return;
    }

    filteredData.forEach(item => {
        const dueDate = new Date((item.due_date || item.purchase_date) + 'T00:00:00');
        const isDelayed = !item.is_paid && dueDate < today;

        let statusBadge = '';
        if (item.is_paid) {
            statusBadge = '<span style="background: #25d36620; color: #20ba5a; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Pago</span>';
        } else if (isDelayed) {
            statusBadge = '<span style="background: #d9534f30; color: #d9534f; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Atrasado</span>';
        } else {
            statusBadge = '<span style="background: #f0ad4e20; color: #f0ad4e; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Pendente</span>';
        }

        const toggleBtnText = item.is_paid ? '<i class="fa-solid fa-rotate-left"></i>' : '<i class="fa-solid fa-check"></i>';
        const purchaseFormatted = item.purchase_date ? item.purchase_date.split('-').reverse().join('/') : '-';
        const dueFormatted = item.due_date ? item.due_date.split('-').reverse().join('/') : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHtml(item.client_name)}</strong></td>
            <td>${escapeHtml(item.product_name)}</td>
            <td>${purchaseFormatted}</td>
            <td>${dueFormatted}</td>
            <td><strong>R$ ${Number(item.total_price).toFixed(2)}</strong></td>
            <td>${statusBadge}</td>
            <td>
                <button class="action-icon-btn edit" title="Alternar Status" onclick="toggleDebtStatus('${item.id}', ${!item.is_paid})">${toggleBtnText}</button>
                <button class="action-icon-btn delete" title="Excluir" onclick="deleteDebt('${item.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function setupDebtForm() {
    const form = document.getElementById('debt-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-debt');
        btn.innerText = 'Salvando...';
        btn.disabled = true;

        const client_name = document.getElementById('debt-client-select').value;
        const purchase_date = document.getElementById('debt-date').value;
        const initialDueDate = document.getElementById('debt-due-date').value;
        const installments = parseInt(document.getElementById('debt-installments').value) || 1;
        const is_paid = document.getElementById('debt-status').value === 'true';

        const rows = document.querySelectorAll('.debt-item-row');
        let itemsList = [];
        let totalItemsPrice = 0;

        rows.forEach(row => {
            const selectVal = row.querySelector('.debt-product-choice').value;
            const manualVal = row.querySelector('.debt-product-manual').value.trim();
            const prodPrice = parseFloat(row.querySelector('.debt-product-price').value) || 0;
            const finalProductName = manualVal || selectVal;

            if (finalProductName) {
                itemsList.push(finalProductName);
                totalItemsPrice += prodPrice;
            }
        });

        if (itemsList.length === 0) {
            showCustomAlert('Adicione pelo menos um produto na compra.', 'Aviso', 'info');
            btn.innerText = 'Salvar Lançamento na Caderneta';
            btn.disabled = false;
            return;
        }

        const combinedProductName = itemsList.join(' + ');
        const basePayload = { client_name, purchase_date, is_paid };
        let success = true;

        if (installments > 1) {
            const installmentValue = totalItemsPrice / installments;
            for (let i = 1; i <= installments; i++) {
                const product_name = `${combinedProductName} (${i}/${installments}x)`;
                const total_price = Number(installmentValue.toFixed(2));
                const currentDueDate = new Date(initialDueDate + 'T00:00:00');
                currentDueDate.setMonth(currentDueDate.getMonth() + (i - 1));
                const due_date = currentDueDate.toISOString().split('T')[0];

                const { error } = await supabaseClient.from('clientes_dividas').insert([{ ...basePayload, product_name, total_price, due_date }]);
                if (error) success = false;
            }
        } else {
            const { error } = await supabaseClient.from('clientes_dividas').insert([{ ...basePayload, product_name: combinedProductName, total_price: totalItemsPrice, due_date: initialDueDate }]);
            if (error) success = false;
        }

        if (!success) showCustomAlert('Erro ao salvar lançamentos.', 'Erro', 'error');
        else {
            showCustomAlert('Compra lançada com sucesso!', 'Sucesso', 'success');
            form.reset();
            closeDebtModal();
            loadAdminDebtsTable();
        }
        btn.innerText = 'Salvar Lançamento na Caderneta';
        btn.disabled = false;
    });
}

window.toggleDebtStatus = async function(id, newStatus) {
    const { error } = await supabaseClient.from('clientes_dividas').update({ is_paid: newStatus }).eq('id', id);
    if (error) showCustomAlert('Erro ao atualizar status: ' + error.message, 'Erro', 'error');
    else {
        loadAdminDebtsTable();
        const historyModal = document.getElementById('history-modal');
        if (historyModal && historyModal.classList.contains('open')) {
            const currentTitle = document.getElementById('history-modal-title').innerText;
            const clientName = currentTitle.replace('Histórico de Compras: ', '');
            if (clientName) openClientHistory(clientName);
        }
    }
}

window.deleteDebt = async function(id) {
    if (confirm('Deseja realmente excluir este registro da caderneta?')) {
        const { error } = await supabaseClient.from('clientes_dividas').delete().eq('id', id);
        if (error) showCustomAlert('Erro ao excluir: ' + error.message, 'Erro', 'error');
        else {
            showCustomAlert('Registro excluído com sucesso!', 'Sucesso', 'success');
            loadAdminDebtsTable();
        }
    }
}

// ==========================================
// 8. CLIENTES E HISTÓRICO
// ==========================================
window.openClientModal = function() {
    const form = document.getElementById('client-form');
    if (form) form.reset();
    document.getElementById('client-id').value = '';
    document.getElementById('client-form-title').innerText = 'Cadastrar Nova Cliente';
    document.getElementById('client-modal').classList.add('open');
}

window.closeClientModal = function() {
    document.getElementById('client-modal').classList.remove('open');
}

async function loadAdminClientsTable() {
    const tbody = document.getElementById('admin-clients-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Carregando clientes...</td></tr>';

    const { data, error } = await supabaseClient.from('clientes').select('*').order('name', { ascending: true });
    if (error || !data) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #d9534f;">Erro ao carregar clientes.</td></tr>';
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #777;">Nenhuma cliente cadastrada.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach(client => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHtml(client.name)}</strong></td>
            <td>${escapeHtml(client.phone || '-')}</td>
            <td>${escapeHtml(client.email || '-')}</td>
            <td>${escapeHtml(client.address || '-')}</td>
            <td>
                <button class="action-icon-btn edit" title="Ver Histórico" onclick="openClientHistory('${escapeHtml(client.name)}')"><i class="fa-solid fa-clock-rotate-left"></i></button>
                <button class="action-icon-btn edit" title="Editar" onclick="prepareEditClient('${client.id}', '${escapeHtml(client.name)}', '${escapeHtml(client.phone || '')}', '${escapeHtml(client.email || '')}', '${escapeHtml(client.address || '')}')"><i class="fa-solid fa-pen"></i></button>
                <button class="action-icon-btn delete" title="Excluir" onclick="deleteClient('${client.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function setupClientForm() {
    const form = document.getElementById('client-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-client');
        btn.innerText = 'Salvando...';
        btn.disabled = true;

        const id = document.getElementById('client-id').value;
        const name = document.getElementById('client-name').value;
        const phone = document.getElementById('client-phone').value;
        const email = document.getElementById('client-email').value;
        const address = document.getElementById('client-address').value;
        const payload = { name, phone, email, address };

        if (id) {
            const { error } = await supabaseClient.from('clientes').update(payload).eq('id', id);
            if (error) showCustomAlert('Erro ao atualizar: ' + error.message, 'Erro', 'error');
            else { showCustomAlert('Cliente atualizada!', 'Sucesso', 'success'); closeClientModal(); loadAdminClientsTable(); }
        } else {
            const { error } = await supabaseClient.from('clientes').insert([payload]);
            if (error) showCustomAlert('Erro ao cadastrar: ' + error.message, 'Erro', 'error');
            else { showCustomAlert('Cliente cadastrada!', 'Sucesso', 'success'); closeClientModal(); loadAdminClientsTable(); }
        }
        btn.innerText = 'Salvar Cliente';
        btn.disabled = false;
    });
}

window.prepareEditClient = function(id, name, phone, email, address) {
    document.getElementById('client-form-title').innerText = 'Editar Cliente';
    document.getElementById('client-id').value = id;
    document.getElementById('client-name').value = name;
    document.getElementById('client-phone').value = phone;
    document.getElementById('client-email').value = email;
    document.getElementById('client-address').value = address;
    document.getElementById('client-modal').classList.add('open');
}

window.deleteClient = async function(id) {
    if (confirm('Deseja realmente remover esta cliente?')) {
        const { error } = await supabaseClient.from('clientes').delete().eq('id', id);
        if (error) showCustomAlert('Erro ao excluir: ' + error.message, 'Erro', 'error');
        else { showCustomAlert('Cliente removida com sucesso!', 'Sucesso', 'success'); loadAdminClientsTable(); }
    }
}

window.openClientHistory = async function(clientName) {
    const modal = document.getElementById('history-modal');
    const titleEl = document.getElementById('history-modal-title');
    const summaryEl = document.getElementById('history-summary-text');
    const tbody = document.getElementById('client-history-table-body');
    
    if (!modal) return;
    titleEl.innerText = `Histórico de Compras: ${clientName}`;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando histórico...</td></tr>';
    summaryEl.innerText = 'Calculando saldo devedor...';
    modal.classList.add('open');

    const { data, error } = await supabaseClient.from('clientes_dividas').select('*').eq('client_name', clientName).order('purchase_date', { ascending: false });
    if (error || !data) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #d9534f;">Erro ao carregar histórico.</td></tr>';
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #777;">Nenhum lançamento encontrado.</td></tr>';
        summaryEl.innerText = 'Nenhuma compra registrada.';
        return;
    }

    tbody.innerHTML = '';
    let totalPending = 0;
    let totalSpent = 0;
    const today = new Date();
    today.setHours(0,0,0,0);

    data.forEach(item => {
        totalSpent += Number(item.total_price);
        if (!item.is_paid) totalPending += Number(item.total_price);

        const dueDate = new Date((item.due_date || item.purchase_date) + 'T00:00:00');
        const isDelayed = !item.is_paid && dueDate < today;

        let statusBadge = '';
        if (item.is_paid) {
            statusBadge = '<span style="background: #25d36620; color: #20ba5a; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Pago</span>';
        } else if (isDelayed) {
            statusBadge = '<span style="background: #d9534f30; color: #d9534f; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Atrasado</span>';
        } else {
            statusBadge = '<span style="background: #f0ad4e20; color: #f0ad4e; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Pendente</span>';
        }

        const toggleBtnText = item.is_paid ? '<i class="fa-solid fa-rotate-left"></i>' : '<i class="fa-solid fa-check"></i>';
        const purchaseFormatted = item.purchase_date ? item.purchase_date.split('-').reverse().join('/') : '-';
        const dueFormatted = item.due_date ? item.due_date.split('-').reverse().join('/') : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${purchaseFormatted}</td>
            <td>${dueFormatted}</td>
            <td><strong>${escapeHtml(item.product_name)}</strong></td>
            <td>R$ ${Number(item.total_price).toFixed(2)}</td>
            <td>${statusBadge}</td>
            <td><button class="action-icon-btn edit" title="Alternar Status" onclick="toggleDebtStatus('${item.id}', ${!item.is_paid})">${toggleBtnText}</button></td>
        `;
        tbody.appendChild(tr);
    });

    summaryEl.innerHTML = `Total Comprado: <strong>R$ ${totalSpent.toFixed(2)}</strong> &nbsp;|&nbsp; Saldo Devedor Atual: <strong style="color: ${totalPending > 0 ? '#d9534f' : '#20ba5a'};">R$ ${totalPending.toFixed(2)}</strong>`;
}

window.closeHistoryModal = function() {
    const modal = document.getElementById('history-modal');
    if (modal) modal.classList.remove('open');
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString().replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ==========================================
// RESERVAS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('admin-reservations-table-body')) {
        loadAdminReservationsTable();
    }

    const whatsappInput = document.getElementById('res-client-whatsapp');
    if (whatsappInput) {
        whatsappInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '');
            if (val.length > 11) {
                val = val.substring(0, 11);
            }
            e.target.value = val;
        });
    }
});

window.openReservationModal = function(name, price, sizesStr, imageUrl = '') {
    document.getElementById('res-product-name').value = name;
    document.getElementById('res-product-price').value = price;
    document.getElementById('res-product-image').value = imageUrl;
    document.getElementById('reservation-product-info').innerHTML = `Peça selecionada: <strong>${escapeHtml(name)}</strong> (R$ ${Number(price).toFixed(2)})`;

    const sizeSelect = document.getElementById('res-product-size');
    if (sizeSelect) {
        sizeSelect.innerHTML = '<option value="">Selecione um tamanho...</option>';
        const sizesArray = Array.isArray(sizesStr) ? sizesStr : (sizesStr ? sizesStr.split(',') : ['P', 'M', 'G']);
        sizesArray.forEach(s => {
            const cleanSize = s.trim();
            if (cleanSize) {
                const opt = document.createElement('option');
                opt.value = cleanSize;
                opt.textContent = cleanSize;
                sizeSelect.appendChild(opt);
            }
        });
    }
    const modal = document.getElementById('reservation-modal');
    if (modal) {
        modal.classList.add('open');
        modal.style.display = 'flex';
    }
}

window.closeReservationModal = function() {
    const modal = document.getElementById('reservation-modal');
    if (modal) {
        modal.classList.remove('open');
        modal.style.display = 'none';
    }
}

// Funções para o Pop-up de Zoom da Foto no ADM
window.openZoomPhoto = function(imageUrl) {
    const modal = document.getElementById('zoom-photo-modal');
    const imgEl = document.getElementById('zoom-modal-img');
    if (modal && imgEl) {
        imgEl.src = imageUrl;
        modal.style.display = 'flex';
    }
}

window.closeZoomPhotoModal = function() {
    const modal = document.getElementById('zoom-photo-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const resForm = document.getElementById('reservation-form');
    if (resForm) {
        resForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-submit-reservation');
            
            const client_whatsapp_input = document.getElementById('res-client-whatsapp').value.trim();
            const client_whatsapp = client_whatsapp_input.replace(/\D/g, '');

            const whatsappRegex = /^[1-9]{2}9?[0-9]{8}$/;
            if (!whatsappRegex.test(client_whatsapp)) {
                showCustomAlert('Por favor, informe um número de WhatsApp válido com DDD (Ex: 27999999999).', 'Número Inválido', 'error');
                return;
            }

            btn.innerText = 'Enviando...';
            btn.disabled = true;

            const product_name = document.getElementById('res-product-name').value;
            const product_price = parseFloat(document.getElementById('res-product-price').value) || 0;
            const product_image = document.getElementById('res-product-image').value || null;
            const product_size = document.getElementById('res-product-size').value;
            const observations = document.getElementById('res-client-observations')?.value.trim() || null;
            
            const productNameWithSize = `${product_name} (Tam: ${product_size})`;

            const payload = {
                product_name: productNameWithSize,
                product_price,
                product_image,
                client_whatsapp,
                observations,
                status: 'pendente'
            };

            const { error } = await supabaseClient
                .from('produtos_reservas')
                .insert([payload]);

            if (error) {
                showCustomAlert('Erro ao solicitar reserva: ' + error.message, 'Erro', 'error');
            } else {
                showCustomAlert('Reserva solicitada com sucesso! Aguarde o contato da loja.', 'Sucesso', 'success');
                resForm.reset();
                closeReservationModal();
            }
            
            btn.innerText = 'Solicitar Reserva';
            btn.disabled = false;
        });
    }
});

async function loadAdminReservationsTable() {
    const tbody = document.getElementById('admin-reservations-table-body');
    if (!tbody) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }

    const statusFilter = document.getElementById('filter-res-status')?.value || 'pendente';
    const searchQuery = document.getElementById('filter-res-query')?.value.toLowerCase().trim() || '';

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando solicitações...</td></tr>';

    const { data, error } = await supabaseClient.from('produtos_reservas').select('*').order('created_at', { ascending: false });
    if (error || !data) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #d9534f;">Erro ao carregar solicitações.</td></tr>';
        return;
    }

    const filteredData = data.filter(item => {
        if (statusFilter !== 'todos' && item.status !== statusFilter) return false;
        if (searchQuery) {
            const prodName = (item.product_name || '').toLowerCase();
            const phone = (item.client_whatsapp || '').toLowerCase();
            if (!prodName.includes(searchQuery) && !phone.includes(searchQuery)) return false;
        }
        return true;
    });

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: #777; padding: 30px;">Nenhuma solicitação encontrada.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    filteredData.forEach(item => {
        const dateFormatted = new Date(item.created_at).toLocaleString('pt-BR');
        let statusBadge = '';
        if (item.status === 'aprovado') {
            statusBadge = '<span style="background: #25d36620; color: #20ba5a; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Aprovado</span>';
        } else if (item.status === 'cancelado') {
            statusBadge = '<span style="background: #d9534f20; color: #d9534f; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Cancelado</span>';
        } else {
            statusBadge = '<span style="background: #f0ad4e20; color: #f0ad4e; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Pendente</span>';
        }

        // Miniatura com clique para abrir a foto maior via pop-up
        const imgHtml = item.product_image 
            ? `<img src="${item.product_image}" width="45" height="45" style="object-fit:cover; border-radius:6px; cursor:pointer; border: 1px solid #ddd;" onclick="openZoomPhoto('${item.product_image}')" title="Clique para ampliar a foto">` 
            : '-';
        
        const obsHtml = item.observations ? `<br><small style="color: #666; font-style: italic;"><i class="fa-solid fa-comment-dots"></i> Obs: ${escapeHtml(item.observations)}</small>` : '';

        // Mensagens do WhatsApp incluindo detalhes, observações e a foto do produto
        let textAprovar = `Olá! Sua reserva da peça *${item.product_name}* foi APROVADA! Vamos combinar?`;
        if (item.observations) textAprovar += `\nObservação enviada: ${item.observations}`;
        if (item.product_image) textAprovar += `\nFoto da peça: ${item.product_image}`;

        let textCancelar = `Olá! Infelizmente não foi possível concluir a reserva da peça *${item.product_name}* no momento.`;
        if (item.product_image) textCancelar += `\nPeça: ${item.product_image}`;

        const msgAprovar = encodeURIComponent(textAprovar);
        const msgCancelar = encodeURIComponent(textCancelar);

        const linkAprovar = `https://wa.me/55${item.client_whatsapp}?text=${msgAprovar}`;
        const linkCancelar = `https://wa.me/55${item.client_whatsapp}?text=${msgCancelar}`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dateFormatted}</td>
            <td><div style="display:flex; align-items:center; gap:10px;">${imgHtml} <div><strong>${escapeHtml(item.product_name)}</strong>${obsHtml}</div></div></td>
            <td>R$ ${Number(item.product_price).toFixed(2)}</td>
            <td><a href="https://wa.me/55${item.client_whatsapp}" target="_blank" style="color: #333; text-decoration: underline;"><i class="fa-brands fa-whatsapp" style="color: #25d366;"></i> ${item.client_whatsapp}</a></td>
            <td>${statusBadge}</td>
            <td>
                <a href="${linkAprovar}" target="_blank" class="action-icon-btn edit" onclick="updateReservationStatus('${item.id}', 'aprovado')" style="background: #25d36620; color: #20ba5a; width: auto; padding: 5px 10px; border-radius: 4px; text-decoration:none; display:inline-block; margin-right:5px;"><i class="fa-solid fa-check"></i> Aprovar</a>
                <a href="${linkCancelar}" target="_blank" class="action-icon-btn delete" onclick="updateReservationStatus('${item.id}', 'cancelado')" style="background: #d9534f20; color: #d9534f; width: auto; padding: 5px 10px; border-radius: 4px; text-decoration:none; display:inline-block;"><i class="fa-solid fa-xmark"></i> Cancelar</a>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.updateReservationStatus = async function(id, newStatus) {
    await supabaseClient.from('produtos_reservas').update({ status: newStatus }).eq('id', id);
    setTimeout(() => { loadAdminReservationsTable(); }, 1000);
}