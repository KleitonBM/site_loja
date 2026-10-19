// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================
const SUPABASE_URL = 'https://uhdytdulurfcpiabynad.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pPRA32kclqxN_gzfhvfREw_nAsXoaI4';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const STORE_WHATSAPP = '5527999999999'; // Número padrão da loja para WhatsApp
const STORAGE_BUCKET = 'produtos-fotos';

// ==========================================
// INICIALIZAÇÃO ÚNICA DA APLICAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // Injeta o HTML do Pop-up Customizado na página se não existir
    injectAlertModalHTML();

    // 1. Vitrine Pública (index.html)
    if (document.getElementById('products-grid')) {
        loadHeroBannerFromAPI(); // Carrega o banner customizável
        loadProductsFromAPI();
        loadTrendsFromAPI(); 
        setupStorefrontFilters();
        updateWhatsappFloat();
    }

    // 2. Tela de Login (login.html)
    if (document.getElementById('login-form')) {
        setupLoginForm();
    }

    // 3. Painel Administrativo Protegido (admin.html)
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
// SISTEMA DE POP-UP / MODAL DE ALERTA MODERNO
// ==========================================
function injectAlertModalHTML() {
    if (document.getElementById('custom-alert-modal')) return;

    const modalHtml = `
        <div id="custom-alert-modal" class="modal-overlay" style="display: none; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 99999;">
            <div class="modal-card" style="background: var(--card-bg, #fff); padding: 25px; border-radius: 12px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                <div id="custom-alert-icon" style="font-size: 2.5rem; margin-bottom: 15px; color: var(--primary-color);"></div>
                <h3 id="custom-alert-title" style="margin-bottom: 10px; font-size: 1.25rem; color: var(--text-primary);">Atenção</h3>
                <p id="custom-alert-message" style="margin-bottom: 20px; color: var(--text-muted); font-size: 0.95rem; line-height: 1.5;"></p>
                <button type="button" id="custom-alert-btn" onclick="closeCustomAlert()" class="btn-primary" style="width: 100%; padding: 10px; border-radius: 6px; cursor: pointer;">OK</button>
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

    if (!modal) {
        alert(message); // Fallback caso o DOM não esteja pronto
        return;
    }

    titleEl.innerText = title;
    msgEl.innerText = message;

    if (type === 'success') {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color: #20ba5a;"></i>';
    } else if (type === 'error') {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="color: #d9534f;"></i>';
    } else {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-info" style="color: var(--primary-color);"></i>';
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
    if (!isEdit) {
        resetAdminForm();
    }
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
// 1. CARREGAR HERO BANNER DINÂMICO NA VITRINE
// ==========================================
async function loadHeroBannerFromAPI() {
    const heroSection = document.querySelector('.hero-banner');
    const subtitleEl = document.querySelector('.hero-subtitle');
    const titleEl = document.querySelector('.hero-banner h2');
    const descEl = document.querySelector('.hero-banner p');

    if (!heroSection) return;

    try {
        const { data } = await supabaseClient
            .from('store_settings')
            .select('*')
            .eq('id', 'main')
            .single();

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
// 2. SITE PRINCIPAL / VITRINE VIA API (index.html)
// ==========================================
let allProducts = [];

async function loadProductsFromAPI() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Buscando lançamentos da API...</p>';

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/produtos?select=*&order=created_at.desc`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) throw new Error('Erro ao conectar com a API do Supabase');

        allProducts = await response.json();
        renderProducts(allProducts);

    } catch (error) {
        console.error(error);
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #d9534f;">Não foi possível carregar os produtos via API.</p>';
    }
}

// Renderização dos cards inspirados em e-commerce (ao clicar no card abre os detalhes)
function renderProducts(products) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    
    grid.innerHTML = '';

    if (!products || products.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">Nenhuma peça disponível na vitrine no momento.</p>';
        return;
    }

    products.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'product-card';

        const prodImages = (prod.images && prod.images.length > 0) ? prod.images : [prod.image_url];
        const mainImage = prodImages[0] || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80';

        const sizes = Array.isArray(prod.sizes) ? prod.sizes : (prod.sizes ? prod.sizes.split(',') : ['P', 'M', 'G']);
        const sizesHtml = sizes.map(s => `<span class="size-pill">${s.trim()}</span>`).join('');
        const oldPriceHtml = prod.old_price ? `<span class="price-old">R$ ${Number(prod.old_price).toFixed(2)}</span>` : '';
        const badgeHtml = prod.old_price ? `<span class="card-badge">Oferta</span>` : '';

        card.onclick = () => openProductDetailModal(prod);

        card.innerHTML = `
            <div class="card-img-wrapper">
                <img src="${mainImage}" alt="${prod.name}" onerror="this.src='https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80'">
                ${badgeHtml}
            </div>
            <div class="card-details">
                <span class="card-category">${prod.category}</span>
                <h3 class="card-title">${prod.name}</h3>
                <div class="card-pricing">
                    <span class="price-current">R$ ${Number(prod.price).toFixed(2)}</span>
                    ${oldPriceHtml}
                </div>
                <div class="sizes-row">${sizesHtml}</div>
                <button type="button" onclick="event.stopPropagation(); openReservationModal('${escapeHtml(prod.name)}', ${prod.price}, '${escapeHtml(sizes.join(','))}')" class="btn-reservar-card">
                    <i class="fa-solid fa-bookmark"></i> Reservar Peça
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

window.openProductDetailModal = function(prod) {
    const modal = document.getElementById('product-detail-modal');
    if (!modal) return;

    const prodImages = (prod.images && prod.images.length > 0) ? prod.images : [prod.image_url];
    const sizes = Array.isArray(prod.sizes) ? prod.sizes : (prod.sizes ? prod.sizes.split(',') : ['P', 'M', 'G']);

    document.getElementById('detail-category').innerText = prod.category;
    document.getElementById('detail-title').innerText = prod.name;
    document.getElementById('detail-price-current').innerText = `R$ ${Number(prod.price).toFixed(2)}`;
    document.getElementById('detail-price-old').innerText = prod.old_price ? `R$ ${Number(prod.old_price).toFixed(2)}` : '';
    document.getElementById('detail-description').innerText = prod.description || 'Sem descrição cadastrada.';

    const sizesRow = document.getElementById('detail-sizes-row');
    sizesRow.innerHTML = sizes.map(s => `<span class="size-pill">${s.trim()}</span>`).join('');

    const mainImg = document.getElementById('detail-main-img');
    mainImg.src = prodImages[0];

    const thumbsGrid = document.getElementById('detail-thumbs-grid');
    thumbsGrid.innerHTML = '';
    
    prodImages.forEach((imgUrl, index) => {
        const thumb = document.createElement('img');
        thumb.src = imgUrl;
        thumb.className = `thumb-img ${index === 0 ? 'active' : ''}`;
        thumb.onclick = () => {
            mainImg.src = imgUrl;
            document.querySelectorAll('.thumb-img').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
        };
        thumbsGrid.appendChild(thumb);
    });

    const resBtn = document.getElementById('btn-open-res-from-detail');
    resBtn.onclick = () => {
        closeProductDetailModal();
        openReservationModal(prod.name, prod.price, sizes.join(','));
    };

    modal.classList.add('open');
}

window.closeProductDetailModal = function() {
    const modal = document.getElementById('product-detail-modal');
    if (modal) modal.classList.remove('open');
}

function setupStorefrontFilters() {
    const searchInput = document.getElementById('input-search');
    const categoryButtons = document.querySelectorAll('.pill-btn');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allProducts.filter(p => 
                p.name.toLowerCase().includes(term) || 
                p.category.toLowerCase().includes(term)
            );
            renderProducts(filtered);
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
        const { data: settingsData } = await supabaseClient
            .from('store_settings')
            .select('trends_title')
            .eq('id', 'main')
            .single();

        if (settingsData && trendsTitleElement) {
            trendsTitleElement.innerText = settingsData.trends_title;
        }

        const response = await fetch(`${SUPABASE_URL}/rest/v1/tendencias?select=*&order=created_at.desc&limit=5`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) return;

        const trends = await response.json();
        if (!trends || trends.length === 0) return;

        trendsGrid.innerHTML = '';
        trends.forEach(trend => {
            const card = document.createElement('div');
            card.className = 'trend-card';
            card.innerHTML = `
                <img src="${trend.image_url}" alt="${trend.title}" onerror="this.src='https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80'">
                <div class="trend-overlay">
                    <span>${trend.tag}</span>
                    <h4>${trend.title}</h4>
                </div>
            `;
            trendsGrid.appendChild(card);
        });
    } catch (err) {
        console.error('Erro ao carregar tendências:', err);
    }
}


// ==========================================
// 3. AUTENTICAÇÃO DO PAINEL ADM (login.html)
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

        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

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
    if (!session) {
        window.location.href = 'login.html';
    }
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
// 4. GESTÃO DO HERO BANNER NO ADM
// ==========================================
function setupHeroBannerForm() {
    const form = document.getElementById('hero-banner-form');
    const subtitleInput = document.getElementById('hero-subtitle-input');
    const titleInput = document.getElementById('hero-title-input');
    const descInput = document.getElementById('hero-desc-input');
    const bgFileInput = document.getElementById('hero-bg-file');

    if (!form) return;

    supabaseClient.from('store_settings').select('*').eq('id', 'main').single()
        .then(({ data }) => {
            if (data) {
                if (data.hero_subtitle) subtitleInput.value = data.hero_subtitle;
                if (data.hero_title) titleInput.value = data.hero_title;
                if (data.hero_description) descInput.value = data.hero_description;
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

            const { error: uploadError } = await supabaseClient.storage
                .from(STORAGE_BUCKET)
                .upload(fileName, file);

            if (uploadError) {
                showCustomAlert('Erro ao enviar imagem de fundo: ' + uploadError.message, 'Erro', 'error');
                btn.innerText = 'Salvar Alterações do Banner';
                btn.disabled = false;
                return;
            }

            const { data: publicURLData } = supabaseClient.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(fileName);

            payload.hero_bg_url = publicURLData.publicUrl;
        }

        const { error } = await supabaseClient
            .from('store_settings')
            .upsert(payload);

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
// 5. GESTÃO DE PRODUTOS NO PAINEL ADM (admin.html)
// ==========================================
async function loadAdminProductsTable() {
    const tableBody = document.getElementById('admin-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Carregando registros...</td></tr>';

    const { data, error } = await supabaseClient
        .from('produtos')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #d9534f;">Erro ao carregar dados.</td></tr>';
        return;
    }

    tableBody.innerHTML = '';
    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Nenhum produto cadastrado.</td></tr>';
        return;
    }

    data.forEach(prod => {
        const prodImages = (prod.images && prod.images.length > 0) ? prod.images : [prod.image_url];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${prodImages[0]}" width="40" height="40" style="object-fit:cover; border-radius:4px;" onerror="this.src='https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=100&q=80'"></td>
            <td><strong>${prod.name}</strong></td>
            <td>${prod.category}</td>
            <td>R$ ${Number(prod.price).toFixed(2)}</td>
            <td>
                <button class="action-icon-btn edit" onclick="prepareEdit('${prod.id}', '${escapeHtml(prod.name)}', ${prod.price}, ${prod.old_price || 'null'}, '${prod.category}', '${escapeHtml(prod.description || '')}')"><i class="fa-solid fa-pen"></i></button>
                <button class="action-icon-btn delete" onclick="deleteProduct('${prod.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
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
            try {
                images = JSON.parse(document.getElementById('prod-images-current').value);
            } catch(e) { images = []; }
        }

        if (fileInput.files && fileInput.files.length > 0) {
            for (let i = 0; i < fileInput.files.length; i++) {
                const file = fileInput.files[i];
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

                const { error: uploadError } = await supabaseClient.storage
                    .from(STORAGE_BUCKET)
                    .upload(fileName, file);

                if (!uploadError) {
                    const { data: publicURLData } = supabaseClient.storage
                        .from(STORAGE_BUCKET)
                        .getPublicUrl(fileName);
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

        const payload = { 
            name, 
            price, 
            old_price, 
            category, 
            sizes, 
            image_url: images[0], 
            images, 
            description 
        };

        if (id) {
            const { error } = await supabaseClient.from('produtos').update(payload).eq('id', id);
            if (error) {
                showCustomAlert('Erro ao atualizar: ' + error.message, 'Erro', 'error');
            } else {
                showCustomAlert('Produto atualizado com sucesso!', 'Sucesso', 'success');
                resetAdminForm(); 
                loadAdminProductsTable(); 
                closeProductModal();
            }
        } else {
            const { error } = await supabaseClient.from('produtos').insert([payload]);
            if (error) {
                showCustomAlert('Erro ao cadastrar: ' + error.message, 'Erro', 'error');
            } else {
                showCustomAlert('Produto cadastrado com sucesso!', 'Sucesso', 'success');
                resetAdminForm(); 
                loadAdminProductsTable(); 
                closeProductModal();
            }
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

    document.getElementById('btn-submit').innerText = 'Atualizar Alterações';
    openProductModal(true);
}

window.deleteProduct = async function(id) {
    if (confirm('Tem certeza que deseja remover este produto?')) {
        const { error } = await supabaseClient.from('produtos').delete().eq('id', id);
        if (error) {
            showCustomAlert('Erro ao excluir: ' + error.message, 'Erro', 'error');
        } else {
            showCustomAlert('Produto removido com sucesso!', 'Sucesso', 'success');
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
    
    const formTitle = document.getElementById('form-title');
    if (formTitle) formTitle.innerText = 'Cadastrar Novo Produto';
    
    const submitBtn = document.getElementById('btn-submit');
    if (submitBtn) submitBtn.innerText = 'Salvar Produto no Banco de Dados';
}


// ==========================================
// 6. GESTÃO DE TENDÊNCIAS NO PAINEL ADM
// ==========================================
function setupTrendsTitleForm() {
    const form = document.getElementById('trends-title-form');
    const inputTitle = document.getElementById('trends-main-title');
    if (!form || !inputTitle) return;

    supabaseClient.from('store_settings').select('trends_title').eq('id', 'main').single()
        .then(({ data }) => {
            if (data && data.trends_title) inputTitle.value = data.trends_title;
        });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newTitle = inputTitle.value;

        const { error } = await supabaseClient
            .from('store_settings')
            .upsert({ id: 'main', trends_title: newTitle });

        if (error) {
            showCustomAlert('Erro ao atualizar título: ' + error.message, 'Erro', 'error');
        } else {
            showCustomAlert('Título da seção de tendências atualizado com sucesso!', 'Sucesso', 'success');
        }
    });
}

async function loadAdminTrendsTable() {
    const tbody = document.getElementById('admin-trends-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Carregando tendências...</td></tr>';

    const { data, error } = await supabaseClient
        .from('tendencias')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhuma tendência cadastrada.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach((trend, index) => {
        const isLimitWarning = index >= 5 ? ' <small style="color:#d9534f;">(Oculto no site - Limite de 5)</small>' : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${trend.image_url}" width="40" height="40" style="object-fit:cover; border-radius:4px;"></td>
            <td><span class="size-pill">${trend.tag}</span></td>
            <td><strong>${trend.title}</strong>${isLimitWarning}</td>
            <td>
                <button class="action-icon-btn delete" onclick="deleteTrend('${trend.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function setupTrendForm() {
    const form = document.getElementById('trend-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-trend');

        const { count } = await supabaseClient.from('tendencias').select('*', { count: 'exact', head: true });
        
        if (count >= 5) {
            if (!confirm('Você já possui 5 tendências ativas. Caso cadastre uma nova, a mais antiga deixará de aparecer na vitrine. Deseja continuar?')) {
                return;
            }
        }

        btn.innerText = 'Enviando foto...';
        btn.disabled = true;

        const tag = document.getElementById('trend-tag').value;
        const title = document.getElementById('trend-title').value;
        const fileInput = document.getElementById('trend-file');

        if (!fileInput.files || !fileInput.files[0]) {
            showCustomAlert('Por favor, selecione uma foto para a tendência.', 'Aviso', 'info');
            btn.innerText = 'Adicionar Tendência';
            btn.disabled = false;
            return;
        }

        const file = fileInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `trend_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

        const { error: uploadError } = await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .upload(fileName, file);

        if (uploadError) {
            showCustomAlert('Erro no upload: ' + uploadError.message, 'Erro', 'error');
            btn.innerText = 'Adicionar Tendência';
            btn.disabled = false;
            return;
        }

        const { data: publicURLData } = supabaseClient.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(fileName);

        const image_url = publicURLData.publicUrl;

        const { error } = await supabaseClient.from('tendencias').insert([{ tag, title, image_url }]);

        if (error) {
            showCustomAlert('Erro ao salvar tendência: ' + error.message, 'Erro', 'error');
        } else {
            showCustomAlert('Tendência cadastrada com sucesso!', 'Sucesso', 'success');
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
        const { error } = await supabaseClient.from('tendencias').delete().eq('id', id);
        if (error) {
            showCustomAlert('Erro ao excluir: ' + error.message, 'Erro', 'error');
        } else {
            showCustomAlert('Tendência removida com sucesso!', 'Sucesso', 'success');
            loadAdminTrendsTable();
        }
    }
}


// ==========================================
// 7. GESTÃO DE DÍVIDAS / CADERNETA (VERTICAL E FLEXÍVEL)
// ==========================================
let availableStoreProducts = [];

async function populateDebtDropdowns() {
    const clientSelect = document.getElementById('debt-client-select');
    
    if (clientSelect) {
        clientSelect.innerHTML = '<option value="">Carregando clientes...</option>';
        const { data: clients } = await supabaseClient.from('clientes').select('name').order('name', { ascending: true });
        if (!clients || clients.length === 0) {
            clientSelect.innerHTML = '<option value="">Nenhuma cliente cadastrada.</option>';
        } else {
            clientSelect.innerHTML = '<option value="">Selecione uma cliente...</option>';
            clients.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.name;
                opt.textContent = c.name;
                clientSelect.appendChild(opt);
            });
        }
    }

    const { data: products } = await supabaseClient.from('produtos').select('name, price').order('name', { ascending: true });
    availableStoreProducts = products || [];

    const container = document.getElementById('debt-items-container');
    if (container) {
        container.innerHTML = '';
        addDebtItemRow();
    }
}

// Adiciona uma nova linha de produto empilhada na vertical
window.addDebtItemRow = function() {
    const container = document.getElementById('debt-items-container');
    if (!container) return;

    const rowId = 'item_row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
    const row = document.createElement('div');
    row.className = 'debt-item-row';
    row.id = rowId;
    row.style.cssText = 'display: grid; grid-template-columns: 1fr 140px 40px; gap: 8px; align-items: center; width: 100%; padding: 10px; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 8px;';

    let productOptions = '<option value="">-- Selecionar da Vitrine (Opcional) --</option>';
    availableStoreProducts.forEach(p => {
        productOptions += `<option value="${escapeHtml(p.name)}" data-price="${p.price}">${p.name} (R$ ${Number(p.price).toFixed(2)})</option>`;
    });

    row.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 6px;">
            <select class="debt-product-choice" onchange="handleDebtProductSelect(this)" style="padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: #fff; font-size: 0.85rem;">
                ${productOptions}
            </select>
            <input type="text" class="debt-product-manual" placeholder="Ou digite o nome da peça/serviço..." style="padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: #fff; font-size: 0.85rem;">
        </div>
        <div>
            <input type="number" step="0.01" class="debt-product-price" placeholder="Valor (R$)" oninput="updateDebtTotal()" required style="padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: #fff; font-size: 0.85rem; width: 100%;">
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
        if (price) {
            priceEl.value = price;
        }
    }
    updateDebtTotal();
}

window.removeDebtItemRow = function(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
        updateDebtTotal();
    }
}

window.updateDebtTotal = function() {
    const priceInputs = document.querySelectorAll('.debt-product-price');
    let total = 0;
    priceInputs.forEach(input => {
        const val = parseFloat(input.value) || 0;
        total += val;
    });

    const totalEl = document.getElementById('debt-total-calculated');
    if (totalEl) {
        totalEl.innerText = `R$ ${total.toFixed(2)}`;
    }
}

window.handlePurchaseDateChange = function() {
    const purchaseDateInput = document.getElementById('debt-date');
    const dueDateInput = document.getElementById('debt-due-date');
    if (!purchaseDateInput || !dueDateInput) return;

    if (purchaseDateInput.value) {
        const pDate = new Date(purchaseDateInput.value + 'T00:00:00');
        pDate.setDate(pDate.getDate() + 30);
        dueDateInput.value = pDate.toISOString().split('T')[0];
    }
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

    const { data, error } = await supabaseClient
        .from('clientes_dividas')
        .select('*')
        .order('purchase_date', { ascending: false });

    if (error || !data) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #d9534f;">Erro ao carregar dados.</td></tr>';
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--text-muted);">Nenhum registro na caderneta.</td></tr>';
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
        if (!item.is_paid) {
            totalPendingSum += Number(item.total_price);
        }
    });

    if (totalSumEl) {
        totalSumEl.innerText = `R$ ${totalPendingSum.toFixed(2)}`;
    }

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-muted); padding: 30px;">Nenhum registro encontrado para o filtro <strong>"${statusFilter.toUpperCase()}"</strong>.</td></tr>`;
        return;
    }

    filteredData.forEach(item => {
        const dueDate = new Date((item.due_date || item.purchase_date) + 'T00:00:00');
        const isDelayed = !item.is_paid && dueDate < today;

        let statusBadge = '';
        if (item.is_paid) {
            statusBadge = '<span style="background: #25d36620; color: #20ba5a; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Pago</span>';
        } else if (isDelayed) {
            statusBadge = '<span style="background: #d9534f30; color: #d9534f; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;" title="Vencimento ultrapassado">Atrasado</span>';
        } else {
            statusBadge = '<span style="background: #f0ad4e20; color: #f0ad4e; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Pendente</span>';
        }

        const toggleBtnText = item.is_paid ? '<i class="fa-solid fa-rotate-left"></i>' : '<i class="fa-solid fa-check"></i>';
        const toggleTitle = item.is_paid ? 'Marcar como Pendente' : 'Marcar como Pago';

        const purchaseFormatted = item.purchase_date ? item.purchase_date.split('-').reverse().join('/') : '-';
        const dueFormatted = item.due_date ? item.due_date.split('-').reverse().join('/') : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.client_name}</strong></td>
            <td>${item.product_name}</td>
            <td>${purchaseFormatted}</td>
            <td>${dueFormatted}</td>
            <td><strong>R$ ${Number(item.total_price).toFixed(2)}</strong></td>
            <td>${statusBadge}</td>
            <td>
                <button class="action-icon-btn edit" title="${toggleTitle}" onclick="toggleDebtStatus('${item.id}', ${!item.is_paid})">${toggleBtnText}</button>
                <button class="action-icon-btn delete" title="Excluir Registro" onclick="deleteDebt('${item.id}')"><i class="fa-solid fa-trash"></i></button>
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
        const basePayload = {
            client_name,
            purchase_date,
            is_paid
        };

        let success = true;

        if (installments > 1) {
            const installmentValue = totalItemsPrice / installments;
            
            for (let i = 1; i <= installments; i++) {
                const product_name = `${combinedProductName} (${i}/${installments}x)`;
                const total_price = Number(installmentValue.toFixed(2));
                
                const currentDueDate = new Date(initialDueDate + 'T00:00:00');
                currentDueDate.setMonth(currentDueDate.getMonth() + (i - 1));
                const due_date = currentDueDate.toISOString().split('T')[0];

                const { error } = await supabaseClient.from('clientes_dividas').insert([{
                    ...basePayload,
                    product_name,
                    total_price,
                    due_date
                }]);
                if (error) success = false;
            }
        } else {
            const { error } = await supabaseClient.from('clientes_dividas').insert([{
                ...basePayload,
                product_name: combinedProductName,
                total_price: totalItemsPrice,
                due_date: initialDueDate
            }]);
            if (error) success = false;
        }

        if (!success) {
            showCustomAlert('Erro ao salvar os lançamentos da caderneta.', 'Erro', 'error');
        } else {
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
    const { error } = await supabaseClient
        .from('clientes_dividas')
        .update({ is_paid: newStatus })
        .eq('id', id);

    if (error) {
        showCustomAlert('Erro ao atualizar status: ' + error.message, 'Erro', 'error');
    } else {
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
        if (error) {
            showCustomAlert('Erro ao excluir: ' + error.message, 'Erro', 'error');
        } else {
            showCustomAlert('Registro excluído com sucesso!', 'Sucesso', 'success');
            loadAdminDebtsTable();
        }
    }
}


// ==========================================
// 8. GESTÃO DE CLIENTES E HISTÓRICO
// ==========================================
window.openClientModal = function() {
    const form = document.getElementById('client-form');
    if (form) form.reset();
    const clientId = document.getElementById('client-id');
    if (clientId) clientId.value = '';
    const title = document.getElementById('client-form-title');
    if (title) title.innerText = 'Cadastrar Nova Cliente';
    
    const modal = document.getElementById('client-modal');
    if (modal) modal.classList.add('open');
}

window.closeClientModal = function() {
    const modal = document.getElementById('client-modal');
    if (modal) modal.classList.remove('open');
}

async function loadAdminClientsTable() {
    const tbody = document.getElementById('admin-clients-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Carregando clientes...</td></tr>';

    const { data, error } = await supabaseClient
        .from('clientes')
        .select('*')
        .order('name', { ascending: true });

    if (error || !data) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #d9534f;">Erro ao carregar clientes.</td></tr>';
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">Nenhuma cliente cadastrada.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach(client => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${client.name}</strong></td>
            <td>${client.phone || '-'}</td>
            <td>${client.email || '-'}</td>
            <td>${client.address || '-'}</td>
            <td>
                <button class="action-icon-btn edit" title="Ver Histórico de Compras" onclick="openClientHistory('${escapeHtml(client.name)}')"><i class="fa-solid fa-clock-rotate-left"></i></button>
                <button class="action-icon-btn edit" title="Editar" onclick="prepareEditClient('${client.id}', '${escapeHtml(client.name)}', '${client.phone || ''}', '${client.email || ''}', '${escapeHtml(client.address || '')}')"><i class="fa-solid fa-pen"></i></button>
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
            if (error) {
                showCustomAlert('Erro ao atualizar cliente: ' + error.message, 'Erro', 'error');
            } else {
                showCustomAlert('Cliente atualizada com sucesso!', 'Sucesso', 'success');
                closeClientModal(); 
                loadAdminClientsTable();
            }
        } else {
            const { error } = await supabaseClient.from('clientes').insert([payload]);
            if (error) {
                showCustomAlert('Erro ao cadastrar cliente: ' + error.message, 'Erro', 'error');
            } else {
                showCustomAlert('Cliente cadastrada com sucesso!', 'Sucesso', 'success');
                closeClientModal(); 
                loadAdminClientsTable();
            }
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

    const modal = document.getElementById('client-modal');
    if (modal) modal.classList.add('open');
}

window.deleteClient = async function(id) {
    if (confirm('Deseja realmente remover esta cliente do cadastro?')) {
        const { error } = await supabaseClient.from('clientes').delete().eq('id', id);
        if (error) {
            showCustomAlert('Erro ao excluir: ' + error.message, 'Erro', 'error');
        } else {
            showCustomAlert('Cliente removida com sucesso!', 'Sucesso', 'success');
            loadAdminClientsTable();
        }
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

    const { data, error } = await supabaseClient
        .from('clientes_dividas')
        .select('*')
        .eq('client_name', clientName)
        .order('purchase_date', { ascending: false });

    if (error || !data) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #d9534f;">Erro ao carregar histórico.</td></tr>';
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">Nenhum lançamento encontrado para esta cliente.</td></tr>';
        summaryEl.innerText = 'Nenhuma compra registrada na caderneta.';
        return;
    }

    tbody.innerHTML = '';
    let totalPending = 0;
    let totalSpent = 0;
    const today = new Date();
    today.setHours(0,0,0,0);

    data.forEach(item => {
        totalSpent += Number(item.total_price);
        if (!item.is_paid) {
            totalPending += Number(item.total_price);
        }

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
        const toggleTitle = item.is_paid ? 'Marcar como Pendente' : 'Marcar como Pago';

        const purchaseFormatted = item.purchase_date ? item.purchase_date.split('-').reverse().join('/') : '-';
        const dueFormatted = item.due_date ? item.due_date.split('-').reverse().join('/') : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${purchaseFormatted}</td>
            <td>${dueFormatted}</td>
            <td><strong>${item.product_name}</strong></td>
            <td>R$ ${Number(item.total_price).toFixed(2)}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="action-icon-btn edit" title="${toggleTitle}" onclick="toggleDebtStatus('${item.id}', ${!item.is_paid})">${toggleBtnText}</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    summaryEl.innerHTML = `Total Comprado: <strong>R$ ${totalSpent.toFixed(2)}</strong> &nbsp;|&nbsp; Saldo Devedor Atual: <strong style="color: ${totalPending > 0 ? '#d9534f' : '#20ba5a'};">R$ ${totalPending.toFixed(2)}</strong>`;
}

window.closeHistoryModal = function() {
    const modal = document.getElementById('history-modal');
    if (modal) modal.classList.contains('open') && modal.classList.remove('open');
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString().replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}


// ==========================================
// FLUXO DE RESERVA DE PRODUTOS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('admin-reservations-table-body')) {
        loadAdminReservationsTable();
    }
});

window.openReservationModal = function(name, price, sizesStr) {
    document.getElementById('res-product-name').value = name;
    document.getElementById('res-product-price').value = price;
    document.getElementById('reservation-product-info').innerHTML = `Peça selecionada: <strong>${name}</strong> (R$ ${Number(price).toFixed(2)})`;

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

    document.getElementById('reservation-modal').classList.add('open');
}

window.closeReservationModal = function() {
    document.getElementById('reservation-modal').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
    const resForm = document.getElementById('reservation-form');
    if (resForm) {
        resForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-submit-reservation');
            btn.innerText = 'Enviando...';
            btn.disabled = true;

            const product_name = document.getElementById('res-product-name').value;
            const product_price = parseFloat(document.getElementById('res-product-price').value);
            const product_size = document.getElementById('res-product-size').value;
            const client_whatsapp = document.getElementById('res-client-whatsapp').value.replace(/\D/g, '');

            const productNameWithSize = `${product_name} (Tam: ${product_size})`;

            const { error } = await supabaseClient.from('produtos_reservas').insert([{
                product_name: productNameWithSize,
                product_price,
                client_whatsapp,
                status: 'pendente'
            }]);

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
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const statusFilter = document.getElementById('filter-res-status')?.value || 'pendente';
    const searchQuery = document.getElementById('filter-res-query')?.value.toLowerCase().trim() || '';

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando solicitações...</td></tr>';

    const { data, error } = await supabaseClient
        .from('produtos_reservas')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !data) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #d9534f;">Erro ao carregar solicitações.</td></tr>';
        return;
    }

    const filteredData = data.filter(item => {
        if (statusFilter !== 'todos' && item.status !== statusFilter) {
            return false;
        }

        if (searchQuery) {
            const prodName = (item.product_name || '').toLowerCase();
            const phone = (item.client_whatsapp || '').toLowerCase();
            if (!prodName.includes(searchQuery) && !phone.includes(searchQuery)) {
                return false;
            }
        }

        return true;
    });

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 30px;">Nenhuma solicitação encontrada para o status <strong>"${statusFilter.toUpperCase()}"</strong>.</td></tr>`;
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

        const msgAprovar = encodeURIComponent(`Olá! Sua reserva da peça *${item.product_name}* (R$ ${Number(item.product_price).toFixed(2)}) foi *APROVADA* com sucesso! Vamos combinar a retirada/entrega?`);
        const msgCancelar = encodeURIComponent(`Olá! Infelizmente não foi possível concluir a reserva da peça *${item.product_name}* no momento. Pedimos desculpas e esperamos te ver em breve!`);

        const linkAprovar = `https://wa.me/55${item.client_whatsapp}?text=${msgAprovar}`;
        const linkCancelar = `https://wa.me/55${item.client_whatsapp}?text=${msgCancelar}`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dateFormatted}</td>
            <td><strong>${item.product_name}</strong></td>
            <td>R$ ${Number(item.product_price).toFixed(2)}</td>
            <td><a href="https://wa.me/55${item.client_whatsapp}" target="_blank" style="color: var(--text-primary); text-decoration: underline;"><i class="fa-brands fa-whatsapp" style="color: #25d366;"></i> ${item.client_whatsapp}</a></td>
            <td>${statusBadge}</td>
            <td>
                <a href="${linkAprovar}" target="_blank" class="action-icon-btn edit" title="Aprovar e Enviar WhatsApp" onclick="updateReservationStatus('${item.id}', 'aprovado')" style="background: #25d36620; color: #20ba5a; width: auto; padding: 5px 10px; border-radius: 4px; text-decoration:none; display:inline-block; margin-right:5px;"><i class="fa-solid fa-check"></i> Aprovar</a>
                <a href="${linkCancelar}" target="_blank" class="action-icon-btn delete" title="Cancelar e Enviar WhatsApp" onclick="updateReservationStatus('${item.id}', 'cancelado')" style="background: #d9534f20; color: #d9534f; width: auto; padding: 5px 10px; border-radius: 4px; text-decoration:none; display:inline-block;"><i class="fa-solid fa-xmark"></i> Cancelar</a>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.updateReservationStatus = async function(id, newStatus) {
    await supabaseClient
        .from('produtos_reservas')
        .update({ status: newStatus })
        .eq('id', id);
    
    setTimeout(() => {
        loadAdminReservationsTable();
    }, 1000);
}