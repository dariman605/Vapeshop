from .models import Cart, CartItem

def cart_context(request):
    cart_id = request.session.get('cart_id')
    if cart_id:
        try:
            cart = Cart.objects.get(session_key=cart_id)
            count = sum(item.quantity for item in cart.items.all())
            return {'cart_count': count}
        except Cart.DoesNotExist:
            pass
    return {'cart_count': 0}