from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from .models import Product, Category, Cart, CartItem
import uuid
from django.http import JsonResponse
from django.db.models import Q
from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate
from .forms import RegisterForm, LoginForm

def search_api(request):
    """API для живого поиска - возвращает JSON с результатами"""
    query = request.GET.get('q', '')
    category_id = request.GET.get('category', '')
    
    products = Product.objects.all()
    
    if query:
        products = products.filter(
            Q(name__icontains=query) | Q(description__icontains=query)
        )
    
    if category_id:
        products = products.filter(category_id=category_id)
    
    # Ограничиваем до 20 результатов
    products = products[:20]
    
    # Формируем список товаров для JSON
    results = []
    for product in products:
        results.append({
            'id': product.pk,
            'name': product.name,
            'price': str(product.price),
            'description': product.description[:100] if product.description else '',
            'image': product.image.url if product.image else '',
            'url': f'/product/{product.pk}/',
        })
    
    return JsonResponse({
        'results': results,
        'count': len(results),
        'query': query,
    })

def product_list(request):
    products = Product.objects.all()
    categories = Category.objects.all()
    query = request.GET.get('q', '')  
    category_id = request.GET.get('category', '') 
    if query:
        products = products.filter(
            Q(name__icontains=query) | Q(description__icontains=query)
        )
    if category_id:
        products = products.filter(category_id=category_id)
    context = {
        'products': products,
        'categories': categories,
        'query': query,
        'selected_category': category_id,
    }
    return render(request, 'products/product_list.html', context)


def product_detail(request, pk):
    product = get_object_or_404(Product, pk=pk)
    
    context = {
        'product': product,
    }
    return render(request, 'products/product_detail.html', context)


def get_or_create_cart(request):
    if 'cart_id' not in request.session:
        request.session['cart_id'] = str(uuid.uuid4())
    
    cart, created = Cart.objects.get_or_create(
        session_key=request.session['cart_id']
    )
    return cart
def add_to_cart(request, product_id):
    if request.method == 'POST':
        product = get_object_or_404(Product, pk=product_id)
        cart = get_or_create_cart(request)
        
        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            defaults={'quantity': 1}
        )
        
        if not created:
            cart_item.quantity += 1
            cart_item.save()
        
        return JsonResponse({'status': 'success', 'message': 'Товар добавлен'})
    
    return JsonResponse({'status': 'error'}, status=400)

def remove_from_cart(request, item_id):
    if request.method == 'POST':
        cart = get_or_create_cart(request)
        try:
            cart_item = CartItem.objects.get(pk=item_id, cart=cart)
            product_name = cart_item.product.name
            cart_item.delete()
            return JsonResponse({
                'status': 'success', 
                'message': f'{product_name} удалён из корзины'
            })
        except CartItem.DoesNotExist:
            return JsonResponse({
                'status': 'error', 
                'message': 'Товар не найден в корзине'
            }, status=404)
    return JsonResponse({'status': 'error'}, status=400)

def cart_view(request):
    cart = get_or_create_cart(request)
    items = cart.items.select_related('product').all()
    
    total = sum(item.total_price for item in items)
    
    context = {
        'items': items,
        'total': total,
    }
    return render(request, 'products/cart.html', context)

def update_cart_item(request, item_id):
    if request.method == 'POST':
        cart = get_or_create_cart(request)
        try:
            cart_item = CartItem.objects.get(pk=item_id, cart=cart)
            action = request.POST.get('action')
            
            if action == 'increment':
                cart_item.quantity += 1
            elif action == 'decrement':
                if cart_item.quantity > 1:
                    cart_item.quantity -= 1
                else:
                    cart_item.delete()
                    return JsonResponse({'status': 'deleted'})
            
            cart_item.save()
            
            return JsonResponse({
                'status': 'success',
                'quantity': cart_item.quantity,
                'total_price': str(cart_item.total_price)
            })
        except CartItem.DoesNotExist:
            return JsonResponse({'status': 'error'}, status=404)
            
    return JsonResponse({'status': 'error'}, status=400)

def cart_count_api(request):
    cart_id = request.session.get('cart_id')
    count = 0
    if cart_id:
        try:
            cart = Cart.objects.get(session_key=cart_id)
            count = sum(item.quantity for item in cart.items.all())
        except Cart.DoesNotExist:
            pass
    return JsonResponse({'count': count})

def register_view(request):
    """Регистрация нового пользователя"""
    if request.user.is_authenticated:
        return redirect('product_list')
        
    if request.method == 'POST':
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user) # Сразу входим после регистрации
            return redirect('product_list')
    else:
        form = RegisterForm()
        
    return render(request, 'products/register.html', {'form': form})

def login_view(request):
    if request.user.is_authenticated:
        return redirect('product_list')
        
    if request.method == 'POST':
        form = LoginForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            return redirect('product_list')
    else:
        form = LoginForm()
    return render(request, 'products/login.html', {'form': form})
def logout_view(request):
    from django.contrib.auth import logout
    logout(request)
    return redirect('product_list')

def checkout_view(request):
    """Оформление заказа (имитация оплаты)"""
    cart = get_or_create_cart(request)
    items = cart.items.select_related('product').all()
    if not items:
        return redirect('product_list')
        
    if request.method == 'POST':
        cart.items.all().delete()
        if 'cart_id' in request.session:
            del request.session['cart_id']
            
        return render(request, 'products/checkout_success.html')

    total = sum(item.total_price for item in items)
    
    return render(request, 'products/checkout.html', {
        'items': items,
        'total': total
    })