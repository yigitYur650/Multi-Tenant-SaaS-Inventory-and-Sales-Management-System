import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import i18next from 'i18next';
import { formatCurrency, formatDate } from '../lib/formatter';
import { Profile } from '../context/AuthContext';

export const pdfService = {
  generateSaleReceipt: (sale: any, profile: Profile | null, shopName: string = 'MAĞAZA') => {
    const doc = new jsPDF({ format: [80, 150] }); // 80mm fiş formatı
    
    // Türkçe karakter uyumluluğu için basit bir replace fonksiyonu (isteğe bağlı)
    const sanitize = (text: string) => text ? text.toString().replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ş/g, 'S').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ç/g, 'C') : '';

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(sanitize(shopName), 40, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(i18next.t('pdf.receipt.title'), 40, 22, { align: 'center' });
    
    doc.setFontSize(8);
    doc.text(`${i18next.t('pdf.receipt.date')}: ${formatDate(sale.created_at, profile)}`, 5, 32);
    doc.text(`${i18next.t('pdf.receipt.receiptNo')}: ${sale.id.split('-')[0].toUpperCase()}`, 5, 36);
    doc.text(`${i18next.t('pdf.receipt.cashier')}: ${sanitize(sale.user_email?.split('@')[0] || 'Admin')}`, 5, 40);

    const tableData = sale.sale_items?.map((item: any) => [
      sanitize(item.product_variants?.products?.name || 'Urun'),
      item.quantity,
      formatCurrency(item.total_price, profile)
    ]) || [];

    autoTable(doc, {
      startY: 45,
      head: [[i18next.t('pdf.receipt.itemHeader'), i18next.t('pdf.receipt.qtyHeader'), i18next.t('pdf.receipt.amountHeader')]],
      body: tableData,
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 1 },
      headStyles: { fontStyle: 'bold', lineWidth: { bottom: 0.5 }, lineColor: 0 },
      margin: { left: 5, right: 5 }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 45;
    
    doc.setFont("helvetica", "bold");
    doc.text("------------------------------------------------", 40, finalY + 5, { align: 'center' });
    doc.text(`${i18next.t('pdf.receipt.total')}: ${formatCurrency(sale.total_amount, profile)}`, 5, finalY + 10);
    
    doc.setFont("helvetica", "normal");
    doc.text(`${i18next.t('pdf.receipt.paymentType')}: ${sale.payment_method}`, 5, finalY + 15);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(i18next.t('pdf.receipt.thankYou1'), 40, finalY + 25, { align: 'center' });
    doc.text(i18next.t('pdf.receipt.thankYou2'), 40, finalY + 29, { align: 'center' });

    doc.save(`Fis_${sale.id.split('-')[0]}.pdf`);
  },

  generateInventoryReport: (products: any[], profile: Profile | null, shopName: string = 'MAĞAZA') => {
    const doc = new jsPDF();
    
    const sanitize = (text: string) => text ? text.toString().replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ş/g, 'S').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ç/g, 'C') : '';

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(`${sanitize(shopName)} - ${i18next.t('pdf.inventory.title')}`, 14, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${i18next.t('pdf.inventory.date')}: ${formatDate(new Date(), profile)}`, 14, 28);

    const tableData: any[] = [];
    
    products.forEach(p => {
      if (p.product_variants && p.product_variants.length > 0) {
        p.product_variants.forEach((v: any) => {
          tableData.push([
            sanitize(p.name),
            v.sku || '-',
            `${sanitize(v.colors?.name || '-')} / ${sanitize(v.sizes?.name || '-')}`,
            v.stock_quantity.toString(),
            formatCurrency(v.retail_price, profile)
          ]);
        });
      } else {
        tableData.push([sanitize(p.name), '-', '-', '0', '-']);
      }
    });

    autoTable(doc, {
      startY: 35,
      head: [[
        i18next.t('pdf.inventory.headers.name'),
        i18next.t('pdf.inventory.headers.sku'),
        i18next.t('pdf.inventory.headers.variant'),
        i18next.t('pdf.inventory.headers.stock'),
        i18next.t('pdf.inventory.headers.price')
      ]],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] } // bg-indigo-600
    });

    doc.save(`Envanter_Raporu_${new Date().toISOString().split('T')[0]}.pdf`);
  },

  generateSalesReport: (filteredSales: any[], periodName: string, profile: Profile | null, shopName: string = 'MAĞAZA') => {
    const doc = new jsPDF();
    const sanitize = (text: string) => text ? text.toString().replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ş/g, 'S').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ç/g, 'C') : '';

    const periodMap: Record<string, string> = {
      daily: i18next.t('pdf.sales.periods.daily'),
      weekly: i18next.t('pdf.sales.periods.weekly'),
      monthly: i18next.t('pdf.sales.periods.monthly'),
      yearly: i18next.t('pdf.sales.periods.yearly'),
      all: i18next.t('pdf.sales.periods.all')
    };
    const titlePeriod = periodMap[periodName] || i18next.t('pdf.sales.title');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(`${sanitize(shopName)} - ${titlePeriod} ${i18next.t('pdf.sales.title')}`, 14, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${i18next.t('pdf.inventory.date')}: ${formatDate(new Date(), profile)}`, 14, 28);

    let grandTotal = 0;
    const tableData = filteredSales.map(sale => {
      const amount = Number(sale.total_amount) || 0;
      grandTotal += amount;
      const itemCount = sale.sale_items?.reduce((sum: number, it: any) => sum + it.quantity, 0) || 0;
      
      return [
        formatDate(sale.created_at, profile),
        sale.id.split('-')[0].toUpperCase(),
        itemCount.toString(),
        formatCurrency(amount, profile)
      ];
    });

    autoTable(doc, {
      startY: 35,
      head: [[
        i18next.t('pdf.sales.headers.date'),
        i18next.t('pdf.sales.headers.saleId'),
        i18next.t('pdf.sales.headers.itemCount'),
        i18next.t('pdf.sales.headers.total')
      ]],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 40;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`${i18next.t('pdf.sales.grandTotal')}: ${formatCurrency(grandTotal, profile)}`, 14, finalY + 10);

    doc.save(`Satis_Raporu_${titlePeriod}_${new Date().toISOString().split('T')[0]}.pdf`);
  }
};
