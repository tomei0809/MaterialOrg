require "net/http"

# Brevo（https://www.brevo.com）の API でメールを送る ActionMailer の配信方法。
# Render の無料プランは SMTP のポート（25・465・587）を使えないため、HTTPS（443）で送る
class BrevoDelivery
  ENDPOINT = URI("https://api.brevo.com/v3/smtp/email")

  attr_reader :settings

  def initialize(settings = {})
    @settings = settings
  end

  def deliver!(mail)
    request = Net::HTTP::Post.new(ENDPOINT, "api-key" => api_key, "content-type" => "application/json",
                                            "accept" => "application/json")
    request.body = payload(mail).to_json
    response = Net::HTTP.start(ENDPOINT.host, ENDPOINT.port, use_ssl: true, open_timeout: 5, read_timeout: 15) do |http|
      http.request(request)
    end
    raise "Brevo へのメール送信に失敗しました（#{response.code}）: #{response.body}" unless response.is_a?(Net::HTTPSuccess)

    response
  end

  private

  def api_key
    settings[:api_key] || ENV.fetch("BREVO_API_KEY")
  end

  def payload(mail)
    sender = mail[:from].addrs.first
    body = {
      sender: { email: sender.address, name: sender.display_name.presence || "MaterialOrg" },
      to: mail.to.map { |address| { email: address } },
      subject: mail.subject,
      textContent: (mail.text_part || mail).body.decoded
    }
    body[:htmlContent] = mail.html_part.body.decoded if mail.html_part
    body
  end
end
