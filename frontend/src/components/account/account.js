import "./account.scss";
import { el, mount } from "redom";
import { createHeader } from "../header/header";
import { getAccountDetails, handleTransfer } from "../../helpers/api";
import { createButton } from "../button/button";
import { createFieldset } from "../fieldset/fieldset";
import Chart from "chart.js/auto";
import { getMonthYear, getRecentMonths } from "../../helpers/getMonths";
import {
  getFromLocalStorage,
  saveToLocalStorage,
} from "../../helpers/localStorage";
import { createDropdownSelect } from "../dropdownSelect/dropdownSelect";

export function createAccount(id, router) {
  const bodyContainer = document.body;
  const header = createHeader(true, router);
  const mainContainer = el("main");

  const accountContainer = el("div.account");
  const chartCanvas = el("canvas", {
    id: "balanceChart",
    width: "584",
    height: "200",
  });

  let form;
  let errorContainer;

  getAccountDetails(id)
    .then((accountDetails) => {
      const detailsContainer = el("div.account", [
        el("div.account-controls", [
          el("h1.account-controls-title", "Просмотр счёта"),
          createButton({
            text: "Вернуться назад",
            hasIcon: true,
            iconClass: "account-controls-button-icon",
            extraClass: "account-controls-button",
            onClick: () => router.navigate("/accounts"),
          }),
        ]),
        el("div.account-details", [
          el("p.account-details-number", `№ ${accountDetails.account}`),
          el("div.account-details-balance", [
            el("p.account-details-balance-subtitle", "Баланс"),
            el(
              "p.account-details-balance-digits",
              `${accountDetails.balance} ₽`
            ),
          ]),
        ]),
        el("div.account-wrapper", [
          (form = el("form.account-wrapper-form", [
            el("p.account-wrapper-title", "Новый перевод"),
            (errorContainer = el("div.account-error-message")),
            createDropdownSelect(
              getFromLocalStorage("savedAccounts") || [],
              "Номер счёта получателя",
              false
            ),
            createFieldset(
              "Сумма перевода",
              "amount",
              "Введите сумму",
              "number"
            ),
            createButton({
              text: "Отправить",
              hasIcon: true,
              iconClass: "account-wrapper-form-button-icon",
              extraClass: "account-wrapper-form-button",
              onClick: async () => {
                const select = document.querySelector(".dropdown-select");
                const accountInput = select.querySelector("input");
                const amountInput = form.querySelector('input[name="amount"]');

                if (!accountInput.value) {
                  errorContainer.textContent = "Выберите счет получателя";
                  errorContainer.style.display = "block"; // Показать уведомление
                  return;
                }

                const amountValue = parseFloat(amountInput.value);

                if (isNaN(amountValue) || amountValue <= 0) {
                  errorContainer.textContent =
                    "Сумма перевода должна быть больше нуля";
                  errorContainer.style.display = "block"; // Показать уведомление
                  return;
                }

                const savedAccounts =
                  getFromLocalStorage("savedAccounts") || [];
                if (!savedAccounts.includes(accountInput.value)) {
                  savedAccounts.push(accountInput.value);
                }

                const formData = {
                  from: id,
                  to: accountInput.value,
                  amount: amountValue,
                };

                try {
                  errorContainer.textContent = "";
                  errorContainer.style.display = "none"; // Скрыть уведомление
                  await handleTransfer(formData);
                  saveToLocalStorage("savedAccounts", savedAccounts);
                  createAccount(id, router);
                } catch (error) {
                  errorContainer.textContent = `Ошибка при отправке перевода: ${error.message}`;
                  errorContainer.style.display = "block"; // Показать уведомление
                  console.error("Ошибка при отправке перевода:", error);
                }
              },
            }),
          ])),
          el("div.account-wrapper-chart", [
            el("p.account-wrapper-title", "Динамика баланса"),
            chartCanvas,
          ]),
        ]),
        el("div.account-table", [
          el("p.account-wrapper-title", "История переводов"),
          createTransactionTable(accountDetails.transactions, id),
        ]),
      ]);
      accountContainer.appendChild(detailsContainer);

      buildBalanceChart(chartCanvas, accountDetails.transactions);

      chartCanvas.addEventListener("click", () => {
        router.navigate(`/account-history/${id}`);
      });
    })

    .catch((error) => {
      console.error("Ошибка при получении данных:", error);
    });

  bodyContainer.innerHTML = "";

  mount(bodyContainer, header);
  mount(mainContainer, accountContainer);
  mount(bodyContainer, mainContainer);

  return bodyContainer;
}

function buildBalanceChart(canvas, transactions) {
  const monthlySums = transactions.reduce((acc, transaction) => {
    const date = new Date(transaction.date);
    const yearMonth = getMonthYear(date);

    if (!acc[yearMonth]) {
      acc[yearMonth] = 0;
    }

    acc[yearMonth] += parseFloat(transaction.amount);

    return acc;
  }, {});

  const allMonths = Object.keys(monthlySums);
  const recentMonths = getRecentMonths(allMonths, 6);
  const balances = recentMonths.map((month) => monthlySums[month]);

  const ctx = canvas.getContext("2d");

  const maxBalance = Math.max(...balances);

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: recentMonths,
      datasets: [
        {
          data: balances,
          backgroundColor: "rgba(17, 106, 204, 1)",
        },
      ],
    },
    options: {
      scales: {
        x: {
          grid: {
            display: false,
          },
        },
        y: {
          position: "right",
          min: 0,
          max: maxBalance,
          beginAtZero: true,
          grid: {
            display: false,
          },
          ticks: {
            stepSize: maxBalance,
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
      },
    },
  });
}

function createTransactionTable(transactions, id) {
  const tableHeader = el("div.account-table-header", [
    el("div.account-table-cell", "Счёт отправителя"),
    el("div.account-table-cell", "Счёт получателя"),
    el("div.account-table-cell", "Сумма"),
    el("div.account-table-cell", "Дата"),
  ]);

  const tableRowsContainer = el("div.account-table-row-wrapper");

  function updateTableRows() {
    tableRowsContainer.textContent = "";

    transactions.slice(-10).forEach((transaction) => {
      const isIncoming = transaction.to === id;

      const color = isIncoming
        ? "rgba(118, 202, 102, 1)"
        : "rgba(253, 78, 93, 1)";
      const sign = isIncoming ? "+" : "-";

      const row = el("div.account-table-row", [
        el("div.account-table-cell", transaction.from),
        el("div.account-table-cell", transaction.to),
        el(
          "div.account-table-cell",
          {
            style: `color: ${color}`,
          },
          `${sign} ${transaction.amount} ₽`
        ),
        el(
          "div.account-table-cell",
          new Date(transaction.date).toLocaleDateString()
        ),
      ]);

      tableRowsContainer.prepend(row);
    });
  }

  updateTableRows();

  return el("div.account-table-wrapper", [tableHeader, tableRowsContainer]);
}
