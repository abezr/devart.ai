"""
Alerting system for the Meta-Agent System.
"""

import smtplib
import ssl
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import json
from typing import Dict, Any, List
from src.utils.logging_config import get_logger
from src.utils.metrics import get_metrics_collector


class AlertManager:
    """Manages alerts for the Meta-Agent System."""

    def __init__(self):
        """Initialize the AlertManager."""
        self.logger = get_logger("alerting")
        self.metrics_collector = get_metrics_collector()
        self.alert_rules = []
        self.alert_history = []

    def add_alert_rule(self, name: str, condition: callable, severity: str = "WARNING", 
                      notification_channels: List[str] = None):
        """
        Add an alert rule.
        
        Args:
            name: Name of the alert rule
            condition: Function that returns True when alert should trigger
            severity: Severity level (INFO, WARNING, ERROR, CRITICAL)
            notification_channels: List of notification channels (email, slack, etc.)
        """
        if notification_channels is None:
            notification_channels = ["email"]
            
        rule = {
            "name": name,
            "condition": condition,
            "severity": severity,
            "notification_channels": notification_channels,
            "enabled": True,
            "last_triggered": None
        }
        
        self.alert_rules.append(rule)
        self.logger.info(f"Added alert rule: {name}")

    def check_alerts(self):
        """Check all alert rules and trigger alerts if conditions are met."""
        for rule in self.alert_rules:
            if not rule["enabled"]:
                continue
                
            try:
                if rule["condition"]():
                    self.trigger_alert(rule)
            except Exception as e:
                self.logger.error(f"Error checking alert rule {rule['name']}: {str(e)}")

    def trigger_alert(self, rule: Dict[str, Any]):
        """
        Trigger an alert based on a rule.
        
        Args:
            rule: Alert rule that triggered
        """
        alert = {
            "name": rule["name"],
            "severity": rule["severity"],
            "timestamp": time.time(),
            "message": f"Alert triggered: {rule['name']}"
        }
        
        self.alert_history.append(alert)
        
        # Log the alert
        self.logger.log(
            getattr(self.logger, rule["severity"].lower(), self.logger.warning),
            f"ALERT: {rule['name']}"
        )
        
        # Send notifications
        for channel in rule["notification_channels"]:
            try:
                if channel == "email":
                    self.send_email_alert(alert)
                # Add other notification channels here (Slack, SMS, etc.)
            except Exception as e:
                self.logger.error(f"Failed to send {channel} alert: {str(e)}")
        
        # Update rule's last triggered time
        rule["last_triggered"] = time.time()
        
        # Increment alert counter
        self.metrics_collector.increment_counter(f"alerts_triggered_{rule['severity'].lower()}")

    def send_email_alert(self, alert: Dict[str, Any]):
        """
        Send an email alert.
        
        Args:
            alert: Alert data to send
        """
        # Get email configuration from environment variables
        smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        sender_email = os.getenv("ALERT_SENDER_EMAIL")
        sender_password = os.getenv("ALERT_SENDER_PASSWORD")
        recipient_email = os.getenv("ALERT_RECIPIENT_EMAIL")
        
        # Check if email configuration is available
        if not all([sender_email, sender_password, recipient_email]):
            self.logger.warning("Email alert configuration incomplete, skipping email alert")
            return
            
        # Create email message
        message = MIMEMultipart("alternative")
        message["Subject"] = f"Meta-Agent Alert: {alert['name']}"
        message["From"] = sender_email
        message["To"] = recipient_email
        
        # Create text content
        text = f"""
        Meta-Agent System Alert
        
        Name: {alert['name']}
        Severity: {alert['severity']}
        Time: {time.ctime(alert['timestamp'])}
        
        This is an automated alert from the Meta-Agent System.
        """
        
        # Add HTML content
        html = f"""
        <html>
          <body>
            <h2>Meta-Agent System Alert</h2>
            <p><strong>Name:</strong> {alert['name']}</p>
            <p><strong>Severity:</strong> {alert['severity']}</p>
            <p><strong>Time:</strong> {time.ctime(alert['timestamp'])}</p>
            <p>This is an automated alert from the Meta-Agent System.</p>
          </body>
        </html>
        """
        
        # Attach parts to message
        part1 = MIMEText(text, "plain")
        part2 = MIMEText(html, "html")
        message.attach(part1)
        message.attach(part2)
        
        # Create secure connection and send email
        context = ssl.create_default_context()
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls(context=context)
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, recipient_email, message.as_string())
            
        self.logger.info(f"Email alert sent: {alert['name']}")

    def get_alert_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Get recent alert history.
        
        Args:
            limit: Maximum number of alerts to return
            
        Returns:
            List of recent alerts
        """
        return self.alert_history[-limit:]

    def enable_alert_rule(self, name: str, enabled: bool = True):
        """
        Enable or disable an alert rule.
        
        Args:
            name: Name of the alert rule
            enabled: Whether to enable or disable the rule
        """
        for rule in self.alert_rules:
            if rule["name"] == name:
                rule["enabled"] = enabled
                self.logger.info(f"Alert rule {name} {'enabled' if enabled else 'disabled'}")
                return
        self.logger.warning(f"Alert rule {name} not found")

    def remove_alert_rule(self, name: str):
        """
        Remove an alert rule.
        
        Args:
            name: Name of the alert rule to remove
        """
        self.alert_rules = [rule for rule in self.alert_rules if rule["name"] != name]
        self.logger.info(f"Removed alert rule: {name}")


# Predefined alert rules
def create_default_alert_rules(alert_manager: AlertManager):
    """
    Create default alert rules for the Meta-Agent System.
    
    Args:
        alert_manager: AlertManager instance to add rules to
    """
    # High error rate alert
    def high_error_rate():
        metrics = alert_manager.metrics_collector.get_metrics_summary()
        if "spans_with_errors" in metrics["counters"] and "spans_finished" in metrics["counters"]:
            error_count = metrics["counters"]["spans_with_errors"]
            total_count = metrics["counters"]["spans_finished"]
            if total_count > 0 and (error_count / total_count) > 0.1:  # More than 10% errors
                return True
        return False
    
    alert_manager.add_alert_rule(
        "High Error Rate",
        high_error_rate,
        "ERROR",
        ["email"]
    )
    
    # Slow response time alert
    def slow_response_time():
        metrics = alert_manager.metrics_collector.get_metrics_summary()
        if "span_durations" in metrics["histograms"]:
            hist = metrics["histograms"]["span_durations"]
            if hist["p95"] > 5.0:  # 95th percentile > 5 seconds
                return True
        return False
    
    alert_manager.add_alert_rule(
        "Slow Response Time",
        slow_response_time,
        "WARNING",
        ["email"]
    )
    
    # High resource usage alert
    def high_resource_usage():
        # This would check system metrics like CPU, memory, etc.
        # For now, we'll just return False
        return False
    
    alert_manager.add_alert_rule(
        "High Resource Usage",
        high_resource_usage,
        "WARNING",
        ["email"]
    )


# Global alert manager instance
alert_manager = AlertManager()


def get_alert_manager() -> AlertManager:
    """
    Get the global alert manager instance.
    
    Returns:
        AlertManager instance
    """
    return alert_manager


# Example usage
if __name__ == "__main__":
    # Create alert manager and add default rules
    manager = get_alert_manager()
    create_default_alert_rules(manager)
    
    # Check alerts (this would normally be called periodically)
    manager.check_alerts()
    
    # Print alert history
    history = manager.get_alert_history()
    print(f"Alert history: {json.dumps(history, indent=2, default=str)}")