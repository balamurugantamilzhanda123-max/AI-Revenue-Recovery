import datetime
from typing import Any
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.services.report_service import (
    generate_report_excel,
    generate_report_pdf,
    get_report_data,
)

router = APIRouter(prefix="/reports", tags=["Reports & Analytics Exports"])


@router.get("")
def get_reports_endpoint(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    status: str | None = Query(default=None),
    failure_type: str | None = Query(default=None),
    recovery_method: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """
    Returns dynamically computed Revenue Recovery report metrics, failure breakdown,
    recovery breakdown, executive findings, and transaction records with optional filters.
    """
    return get_report_data(
        db=db,
        date_from=date_from,
        date_to=date_to,
        status=status,
        failure_type=failure_type,
        recovery_method=recovery_method,
    )


@router.get("/pdf")
def download_pdf_report(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    status: str | None = Query(default=None),
    failure_type: str | None = Query(default=None),
    recovery_method: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
):
    """
    Generates and returns downloadable professional A4 PDF report with real-time database data.
    """
    report_data = get_report_data(
        db=db,
        date_from=date_from,
        date_to=date_to,
        status=status,
        failure_type=failure_type,
        recovery_method=recovery_method,
    )
    pdf_bytes = generate_report_pdf(report_data)
    cur_time = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d_%H-%M")
    filename = f"ReviveAI_Revenue_Recovery_Report_{cur_time}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get("/excel")
def download_excel_report(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    status: str | None = Query(default=None),
    failure_type: str | None = Query(default=None),
    recovery_method: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
):
    """
    Generates and returns downloadable 5-sheet Excel spreadsheet report with real-time database data.
    """
    report_data = get_report_data(
        db=db,
        date_from=date_from,
        date_to=date_to,
        status=status,
        failure_type=failure_type,
        recovery_method=recovery_method,
    )
    excel_bytes = generate_report_excel(report_data)
    cur_time = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d_%H-%M")
    filename = f"ReviveAI_Revenue_Recovery_Report_{cur_time}.xlsx"

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
