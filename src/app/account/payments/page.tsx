export default function PaymentsPage() {
  return (
    <section className="rounded-[28px] border border-[#d5e1ea] bg-white p-6 shadow-sm">
      <h1 className="brand-font text-2xl font-semibold text-[#0f2a36]">
        Lịch sử thanh toán
      </h1>
      <p className="mt-2 text-sm leading-6 text-[#5b6b7c]">
        Chưa có giao dịch nào. Khi hệ thống thu phí / nạp credit được bật, các
        hóa đơn sẽ hiện ở đây.
      </p>
      <div className="mt-6 rounded-[20px] border border-dashed border-[#9bb4c2] bg-[#f7f9fb] px-5 py-10 text-center text-sm text-[#8a98a8]">
        Trống
      </div>
    </section>
  );
}
