<script language="JavaScript">
  if (window.top != window.self){
    window.paypal.Buttons({
      async createOrder() {
        const url = "{{ settings["Payments/PayPal/CreateOrderURL"] }}";

        const payload = {
          eventData: JSON.stringify({
            amount: 100
          })
        };
        var orderId;

        await shell
          .ajaxSafePost({
            type: "POST",
            contentType: "application/json",
            url: url,
            data: JSON.stringify(payload),
            processData: false,
            global: false,
          })
          .done(function (response) {
            const orderData = JSON.parse(response);
            console.log(response);

            if (orderData.order_id) {
              orderId = orderData.order_id;
            } else {
              const errorDetail = orderData.details[0];
              const errorMessage = errorDetail
                ? `${errorDetail.issue} ${errorDetail.description} (${orderData.debug_id})`
                : JSON.stringify(orderData);

              throw new Error(errorMessage);
            }
          })
          .fail(function () {
            console.error(error);
            resultMessage(`Could not initiate PayPal Checkout...<br><br>${error}`);
          });

        return orderId;

      },
      async onApprove(data, actions) {
        const url = "{{ settings["Payments/PayPal/CaptureOrderURL"] }}";
        const payload = {
          eventData: JSON.stringify({
            order_id: data.orderID
          })
        };

        await shell
          .ajaxSafePost({
            type: "POST",
            contentType: "application/json",
            url: url,
            data: JSON.stringify(payload),
            processData: false,
            global: false,
          })
          .done(function (response) {
            console.log(`Capture response: ${response}`);
            const flowResponse = JSON.parse(response);
            const orderData = JSON.parse(flowResponse.order_data);
            console.log(`Order data: ${orderData}`);
            if (orderData.details) {
              const errorDetail = orderData.details[0];

              if (errorDetail.issue === "INSTRUMENT_DECLINED") {
                // (1) Recoverable INSTRUMENT_DECLINED -> call actions.restart()
                // recoverable state, per https://developer.paypal.com/docs/checkout/standard/customize/handle-funding-failures/
                return actions.restart();
              } else {
                // (2) Other non-recoverable errors -> Show a failure message
                throw new Error(`${errorDetail.description} (${orderData.debug_id})`);
              };
            };

            if (!orderData.purchase_units)
              throw new Error(JSON.stringify(orderData));

            // (3) Successful transaction -> Show confirmation or thank you message
            // Or go to another URL:  actions.redirect('thank_you.html');
            const transaction =
              orderData.purchase_units[0].payments.captures[0] ||
              orderData.purchase_units[0].payments.authorizations[0];
            resultMessage(
              `Transaction ${transaction.status}: ${transaction.id}<br><br>See console for all available details`,
            );
            console.log(
              "Capture result",
              orderData,
              JSON.stringify(orderData, null, 2),
            );
          })
          .fail(function () {
            console.error(error);
            resultMessage(`Could not capture PayPal order...<br><br>${error}`);
          });


      },
    })
    .render("#paypal-button-container");

    // Example function to show a result to the user. Your site's UI library can be used instead.
    function resultMessage(message) {
      const container = document.querySelector("#result-message");
      container.innerHTML = message;
    }
  }
</script>