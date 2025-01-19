<?php

// Only process POST requests.
if ($_SERVER["REQUEST_METHOD"] === "POST") {

  // 1. Get the form fields and remove whitespace.
  //    Always sanitize user input to prevent security issues.
  $name    = strip_tags(trim($_POST["name"]));
  $email   = filter_var(trim($_POST["email"]), FILTER_SANITIZE_EMAIL);
  $subject = trim($_POST["subject"]);
  $message = trim($_POST["message"]);

  // 2. Check that data was sent
  if ( empty($name) OR empty($subject) OR empty($message) OR !filter_var($email, FILTER_VALIDATE_EMAIL) ) {
    // If any required field is empty, or email is invalid, return an error
    // You can customize the error message or JSON response here
    http_response_code(400);
    echo "Oops! Please complete the form and try again.";
    exit;
  }

  // 3. Set the recipient email address.
  //    Replace with YOUR email where you want to receive the form submissions
  $recipient = "rvasa7@gatech.edu";

  // 4. Build the email headers & content.
  $email_content  = "Name: $name\n";
  $email_content .= "Email: $email\n\n";
  $email_content .= "Message:\n$message\n";

  // (Optional) You can add more headers if needed
  // e.g., From can be set to the $email or to a no-reply address on your domain
  $email_headers = "From: $name <$email>";

  // 5. Send the email.
  if (mail($recipient, $subject, $email_content, $email_headers)) {
    // The email was successfully sent.
    http_response_code(200);
    echo "Thank You! Your message has been sent.";
  } else {
    // The mail function failed.
    http_response_code(500);
    echo "Oops! Something went wrong and we couldn't send your message.";
  }

} else {
  // If not a POST request, set a 403 (forbidden) response code.
  http_response_code(403);
  echo "There was a problem with your submission; please try again.";
}
?>
