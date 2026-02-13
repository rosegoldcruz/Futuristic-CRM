"""
PDF generation service for quotes, work orders, and agreements
"""
from typing import Optional, Dict, Any
from io import BytesIO
from datetime import datetime


class PDFGenerator:
    """PDF generation service using HTML to PDF conversion"""
    
    @staticmethod
    def generate_quote_pdf(quote_data: Dict[str, Any]) -> BytesIO:
        """Generate a PDF for a quote"""
        html_content = PDFGenerator._generate_quote_html(quote_data)
        return PDFGenerator._html_to_pdf(html_content)
    
    @staticmethod
    def generate_work_order_pdf(work_order_data: Dict[str, Any]) -> BytesIO:
        """Generate a PDF for a work order"""
        html_content = PDFGenerator._generate_work_order_html(work_order_data)
        return PDFGenerator._html_to_pdf(html_content)
    
    @staticmethod
    def generate_agreement_pdf(agreement_data: Dict[str, Any]) -> BytesIO:
        """Generate a PDF for an agreement/contract"""
        html_content = PDFGenerator._generate_agreement_html(agreement_data)
        return PDFGenerator._html_to_pdf(html_content)
    
    @staticmethod
    def _html_to_pdf(html_content: str) -> BytesIO:
        """Convert HTML to PDF using simple HTML rendering"""
        try:
            from weasyprint import HTML
            pdf_bytes = BytesIO()
            HTML(string=html_content).write_pdf(pdf_bytes)
            pdf_bytes.seek(0)
            return pdf_bytes
        except ImportError:
            # Fallback: Generate a simple text-based PDF if weasyprint not available
            return PDFGenerator._generate_simple_pdf(html_content)
    
    @staticmethod
    def _generate_simple_pdf(content: str) -> BytesIO:
        """Generate a simple PDF without external dependencies"""
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        story = []
        styles = getSampleStyleSheet()
        
        # Add content
        story.append(Paragraph("AEON Document", styles['Heading1']))
        story.append(Spacer(1, 0.2 * inch))
        
        # Strip HTML tags for simple rendering
        import re
        clean_content = re.sub('<[^<]+?>', '', content)
        for line in clean_content.split('\n'):
            if line.strip():
                story.append(Paragraph(line.strip(), styles['Normal']))
                story.append(Spacer(1, 0.1 * inch))
        
        doc.build(story)
        buffer.seek(0)
        return buffer
    
    @staticmethod
    def _generate_quote_html(quote: Dict[str, Any]) -> str:
        """Generate HTML for quote PDF"""
        line_items = quote.get('line_items', [])
        
        items_html = ""
        for item in line_items:
            items_html += f"""
            <tr>
                <td style="border-bottom: 1px solid #e5e7eb; padding: 12px;">{item.get('description', 'N/A')}</td>
                <td style="border-bottom: 1px solid #e5e7eb; padding: 12px; text-align: center;">{item.get('quantity', 1)}</td>
                <td style="border-bottom: 1px solid #e5e7eb; padding: 12px; text-align: right;">${item.get('unit_price', 0):.2f}</td>
                <td style="border-bottom: 1px solid #e5e7eb; padding: 12px; text-align: right;">${item.get('total', 0):.2f}</td>
            </tr>
            """
        
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; color: #1f2937; }}
                .header {{ text-align: center; margin-bottom: 40px; }}
                .header h1 {{ color: #f59e0b; margin: 0; }}
                .info-section {{ margin-bottom: 30px; }}
                .info-label {{ font-weight: bold; color: #6b7280; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
                th {{ background-color: #f3f4f6; padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; }}
                .total-section {{ margin-top: 30px; text-align: right; }}
                .total-row {{ font-size: 18px; font-weight: bold; margin-top: 10px; }}
                .footer {{ margin-top: 60px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>AEON</h1>
                <p style="color: #6b7280; margin: 5px 0;">Solar Installation Quote</p>
            </div>
            
            <div class="info-section">
                <p><span class="info-label">Quote #:</span> {quote.get('id', 'N/A')}</p>
                <p><span class="info-label">Customer:</span> {quote.get('customer_name', 'N/A')}</p>
                <p><span class="info-label">Date:</span> {quote.get('created_at', datetime.now().strftime('%Y-%m-%d'))}</p>
                <p><span class="info-label">Status:</span> {quote.get('status', 'draft').upper()}</p>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th style="text-align: center;">Quantity</th>
                        <th style="text-align: right;">Unit Price</th>
                        <th style="text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items_html}
                </tbody>
            </table>
            
            <div class="total-section">
                <div class="total-row">
                    Total: ${quote.get('total_price', 0):.2f}
                </div>
            </div>
            
            <div class="footer">
                <p>Thank you for choosing AEON Solar!</p>
                <p style="font-size: 12px;">This quote is valid for 30 days from the date of issue.</p>
            </div>
        </body>
        </html>
        """
    
    @staticmethod
    def _generate_work_order_html(work_order: Dict[str, Any]) -> str:
        """Generate HTML for work order PDF"""
        materials = work_order.get('materials', [])
        labor = work_order.get('labor', [])
        
        materials_html = ""
        for item in materials:
            materials_html += f"""
            <tr>
                <td style="border-bottom: 1px solid #e5e7eb; padding: 12px;">{item.get('name', 'N/A')}</td>
                <td style="border-bottom: 1px solid #e5e7eb; padding: 12px; text-align: center;">{item.get('quantity', 0)}</td>
                <td style="border-bottom: 1px solid #e5e7eb; padding: 12px;">{item.get('unit', 'pcs')}</td>
            </tr>
            """
        
        labor_html = ""
        for item in labor:
            labor_html += f"""
            <tr>
                <td style="border-bottom: 1px solid #e5e7eb; padding: 12px;">{item.get('task', 'N/A')}</td>
                <td style="border-bottom: 1px solid #e5e7eb; padding: 12px; text-align: center;">{item.get('hours', 0)}</td>
            </tr>
            """
        
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; color: #1f2937; }}
                .header {{ text-align: center; margin-bottom: 40px; }}
                .header h1 {{ color: #f59e0b; margin: 0; }}
                .section {{ margin-bottom: 30px; }}
                .section h2 {{ color: #374151; border-bottom: 2px solid #f59e0b; padding-bottom: 8px; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
                th {{ background-color: #f3f4f6; padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; }}
                .info-label {{ font-weight: bold; color: #6b7280; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>AEON</h1>
                <p style="color: #6b7280; margin: 5px 0;">Work Order</p>
            </div>
            
            <div class="section">
                <p><span class="info-label">Work Order #:</span> {work_order.get('work_order_number', 'N/A')}</p>
                <p><span class="info-label">Customer:</span> {work_order.get('customer_name', 'N/A')}</p>
                <p><span class="info-label">Installer:</span> {work_order.get('installer_name', 'Not assigned')}</p>
                <p><span class="info-label">Status:</span> {work_order.get('status', 'pending').upper()}</p>
            </div>
            
            <div class="section">
                <h2>Materials Required</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th style="text-align: center;">Quantity</th>
                            <th>Unit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {materials_html or '<tr><td colspan="3" style="text-align: center; padding: 20px; color: #9ca3af;">No materials specified</td></tr>'}
                    </tbody>
                </table>
            </div>
            
            <div class="section">
                <h2>Labor Tasks</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Task</th>
                            <th style="text-align: center;">Estimated Hours</th>
                        </tr>
                    </thead>
                    <tbody>
                        {labor_html or '<tr><td colspan="2" style="text-align: center; padding: 20px; color: #9ca3af;">No labor tasks specified</td></tr>'}
                    </tbody>
                </table>
            </div>
            
            <div class="section">
                <h2>Instructions</h2>
                <p>{work_order.get('instructions', 'No special instructions.')}</p>
            </div>
        </body>
        </html>
        """
    
    @staticmethod
    def _generate_agreement_html(agreement: Dict[str, Any]) -> str:
        """Generate HTML for agreement/contract PDF"""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; color: #1f2937; line-height: 1.6; }}
                .header {{ text-align: center; margin-bottom: 40px; }}
                .header h1 {{ color: #f59e0b; margin: 0; }}
                .section {{ margin-bottom: 30px; }}
                .section h2 {{ color: #374151; border-bottom: 2px solid #f59e0b; padding-bottom: 8px; }}
                .signature-line {{ border-top: 1px solid #000; width: 300px; margin-top: 60px; }}
                .signature-block {{ margin-top: 60px; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>AEON</h1>
                <p style="color: #6b7280; margin: 5px 0;">Solar Installation Agreement</p>
            </div>
            
            <div class="section">
                <h2>Agreement Details</h2>
                <p><strong>Agreement ID:</strong> {agreement.get('id', 'N/A')}</p>
                <p><strong>Customer:</strong> {agreement.get('customer_name', 'N/A')}</p>
                <p><strong>Date:</strong> {agreement.get('created_at', datetime.now().strftime('%Y-%m-%d'))}</p>
            </div>
            
            <div class="section">
                <h2>Terms and Conditions</h2>
                <p>{agreement.get('terms', 'Standard terms and conditions apply.')}</p>
            </div>
            
            <div class="section">
                <h2>Project Scope</h2>
                <p>{agreement.get('scope', 'Solar panel installation as per quoted specifications.')}</p>
            </div>
            
            <div class="section">
                <h2>Payment Terms</h2>
                <p>{agreement.get('payment_terms', 'Payment as agreed upon quote acceptance.')}</p>
            </div>
            
            <div class="signature-block">
                <p><strong>Customer Signature:</strong></p>
                <div class="signature-line"></div>
                <p style="margin-top: 5px;">Date: _________________</p>
            </div>
            
            <div class="signature-block">
                <p><strong>AEON Representative:</strong></p>
                <div class="signature-line"></div>
                <p style="margin-top: 5px;">Date: _________________</p>
            </div>
        </body>
        </html>
        """
