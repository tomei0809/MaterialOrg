# Brevo の API で送る配信方法（lib/brevo_delivery.rb）を登録する
ActiveSupport.on_load(:action_mailer) do
  add_delivery_method :brevo, BrevoDelivery
end
