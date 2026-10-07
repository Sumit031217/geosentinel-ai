from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
import io

def generate_pdf_report(region_name, date_range, total_area, summary_text):
    """Generates a professional PDF intelligence report in-memory."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    # Title
    story.append(Paragraph(f"GeoSentinel AI: Change Analysis Report", styles['Title']))
    story.append(Spacer(1, 12))

    # Metadata
    story.append(Paragraph(f"<b>Region:</b> {region_name}", styles['Normal']))
    story.append(Paragraph(f"<b>Period:</b> {date_range}", styles['Normal']))
    story.append(Paragraph(f"<b>Total Changed Area:</b> {total_area} km²", styles['Normal']))
    story.append(Spacer(1, 12))

    # AI Summary
    story.append(Paragraph("<b>Executive Summary</b>", styles['Heading2']))
    story.append(Paragraph(summary_text, styles['Normal']))
    story.append(Spacer(1, 24))

    # Strict Disclaimer
    disclaimer = ("DISCLAIMER: Satellite imagery analysis is probabilistic and may contain errors. "
                  "Results should be independently verified before operational decisions. "
                  "Scores reflect physical delta, not human intent.")
    story.append(Paragraph(f"<i>{disclaimer}</i>", styles['Italic']))

    doc.build(story)
    buffer.seek(0)
    return buffer