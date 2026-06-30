document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search-input');
    const searchDropdown = document.getElementById('search-dropdown');
    const searchForm = document.getElementById('search-form');
    if (searchInput) {
            let searchTimeout;
        searchInput.addEventListener('input', function() {
            const query = this.value.trim();
            clearTimeout(searchTimeout);
            if (query.length < 2) {
                searchDropdown.classList.remove('active');
                return;
            }
            searchTimeout = setTimeout(() => {
                performLiveSearch(query);
            }, 300);
        });
        document.addEventListener('click', function(e) {
            if (!searchForm.contains(e.target) && !searchDropdown.contains(e.target)) {
                searchDropdown.classList.remove('active');
            }
        });
        searchInput.addEventListener('focus', function() {
            if (searchDropdown.innerHTML) {
                searchDropdown.classList.add('active');
            }
        });
    }
    function performLiveSearch(query) {
        fetch(`/api/search/?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                renderSearchResults(data.results, query);
            })
           .catch(error => {
                console.error('Ошибка поиска:', error);
         });
    }
    function renderSearchResults(results, query) {
        if (results.length === 0) {
            searchDropdown.innerHTML = `
                <div class="search-no-results">
                    Ничего не найдено по запросу "${escapeHtml(query)}"
                </div>
            `;
            searchDropdown.classList.add('active');
            return;
        }
        let html = '';
        results.forEach(product => {
            const highlightedName = highlightText(product.name, query);
            const image = product.image 
                ? `<img src="${product.image}" alt="${escapeHtml(product.name)}" class="search-result-image">`
                : `<div class="search-result-image"></div>`;        
            html += `
                <a href="${product.url}" class="search-result-item">
                    ${image}
                    <div class="search-result-info">
                        <div class="search-result-name">${highlightedName}</div>
                            <div class="search-result-price">${product.price} ₽</div>
                    </div>
                </a>
            `;
        });
    
        searchDropdown.innerHTML = html;
        searchDropdown.classList.add('active');
    }
    function highlightText(text, query) {
        if (!query) return escapeHtml(text); 
        const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
        return escapeHtml(text).replace(regex, '<span class="search-highlight">$1</span>');
    }
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    console.log('Магазин загружен!');
    initCart();
});

function initCart() {
    const addToCartButtons = document.querySelectorAll('.add-to-cart-btn');
    addToCartButtons.forEach(button => {
        button.addEventListener('click', function(e) {
        e.preventDefault(); // Предотвращаем переход по ссылке
            const productId = this.dataset.productId;
            addToCartFromCard(this, productId);
        });
    });
    console.log('Инициализация корзины...');
    
    const deleteButtons = document.querySelectorAll('.cart-delete-item');
    console.log('Найдено кнопок удаления:', deleteButtons.length);
    
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const itemId = this.dataset.itemId;
            const productName = this.dataset.productName;
            removeFromCart(itemId, this, productName);
        });
    });
    const qtyButtons = document.querySelectorAll('.qty-btn');
    console.log('Найдено кнопок количества:', qtyButtons.length);
    
    qtyButtons.forEach(button => {
        button.addEventListener('click', function() {
            const itemId = this.dataset.itemId;
            const action = this.dataset.action;
            console.log('Клик по кнопке:', itemId, action);
            updateCartItem(itemId, action, this);
        });
    });
}

function removeFromCart(itemId, buttonElement, productName) {
    fetch(`/cart/remove/${itemId}/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCSRFToken(),
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            const cartItem = buttonElement.closest('.cart-item');
            if (cartItem) {
                cartItem.style.opacity = '0';
                cartItem.style.transform = 'translateX(-20px)';
                
                setTimeout(() => {
                    cartItem.remove();
                    checkEmptyCart();
                }, 200);
            }
            showNotification(`"${productName}" удалён из корзины`, 'success');
        } else {
            showNotification(data.message || 'Ошибка при удалении', 'error');
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
        showNotification('Произошла ошибка сети', 'error');
    });
}

function updateCartItem(itemId, action, buttonElement) {
    console.log('Обновление товара:', itemId, action);
    
    const controls = buttonElement.closest('.cart-item-controls');
    controls.style.pointerEvents = 'none';
    controls.style.opacity = '0.5';

    fetch(`/cart/update/${itemId}/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCSRFToken(),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=${action}`
    })
    .then(response => response.json())
    .then(data => {
        console.log('Ответ сервера:', data);
        
        if (data.status === 'success') {
            document.getElementById(`qty-${itemId}`).textContent = data.quantity;
            document.getElementById(`price-${itemId}`).textContent = `${data.total_price} ₽`;
        } else if (data.status === 'deleted') {
            const cartItem = document.getElementById(`cart-item-${itemId}`);
            if (cartItem) {
                cartItem.remove();
            }
            checkEmptyCart();
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
        showNotification('Ошибка при обновлении', 'error');
    })
    .finally(() => {
        controls.style.pointerEvents = 'auto';
        controls.style.opacity = '1';
    });
}

function checkEmptyCart() {
    const remainingItems = document.querySelectorAll('.cart-item');
    if (remainingItems.length === 0) {
        location.reload();
    } else {
        updateCartCount();
    }
}

function updateCartCount() {
    const items = document.querySelectorAll('.cart-item');
    const subtitle = document.querySelector('.page-subtitle');
    if (subtitle) {
        subtitle.textContent = `${items.length} товаров`;
    }
}

function getCSRFToken() {
    const name = 'csrftoken';
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

function addToCartFromCard(button, productId) {
    button.disabled = true;
    const originalText = button.innerHTML;
    fetch(`/cart/add/${productId}/`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCSRFToken(),
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            button.innerHTML = '✓ Добавлено';
            button.classList.add('added');
            updateCartBadge();
            showNotification('Товар добавлен в корзину', 'success');
            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('added');
                button.disabled = false;
            }, 2000);
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
        button.disabled = false;
    });
}

function updateCartBadge() {
    fetch('/api/cart-count/')
        .then(response => response.json())
        .then(data => {
            const badge = document.querySelector('.cart-badge');
            if (badge) {
                badge.textContent = data.count;
                badge.style.display = data.count > 0 ? 'inline-block' : 'none';
            }
        })
        .catch(error => console.error('Ошибка обновления счётчика:', error));
}