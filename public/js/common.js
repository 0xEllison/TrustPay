var account = 0x0;
var account_mask = "0x0";
function mask(_account) {
    return _account.slice(0, 5) + "***" + _account.slice(-4);
}
async function getAccount(accounts) {
    this.provider = new ethers.providers.Web3Provider(window.ethereum);
    if (!accounts) accounts = await this.provider.send("eth_requestAccounts", []);
    account = accounts[0];
    account_mask = mask(account);
    $("#address").text(account_mask);
    //获取链上ETH余额
    // this.provider.getBalance(account).then((balance) => {
    //     // 余额是 BigNumber (in wei); 格式化为 ether 字符串
    //     let etherString = parseFloat(ethers.utils.formatEther(balance)).toFixed(4);
    //     $("#balance").text(etherString + " ETH");
    // });
    //获取网络信息
    this.provider.getNetwork().then((network) => {
        var networkName = "";
        switch (network.chainId) {
            case 1: networkName = "Ethereum"; break;
            case 5: networkName = "Goerli"; break;
            case 5777: networkName = "Ganache"; break;
            default: networkName = "unknow";
        }
        $("#network").text(networkName);
    });
    //获取ESB余额
    getBalance();
    getHistory();
}
getAccount();
ethereum.on('accountsChanged', (accounts) => {
    getAccount(accounts);
});
ethereum.on('chainChanged', (chainName) => {
    getAccount();
});

const abiTrustpay = [
    "function addTrade(uint256 _amount)",
    "function getTrade(uint256 _id) view returns (address,address,uint256,uint8)",
    "function executeTrade(uint256 _id)",
    "function getVerify(uint256 _id) public view returns(uint)",
    "function withdrawTrade(uint256 _id,uint _verify)",
    "event TradeStatusChange(address indexed creator,address indexed payer,uint256 id,uint256 amount,uint8 status)",
    "event AddTrade(uint256 id,uint256 amount,uint8 status)"
];
const abiERC20 = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint)",
    "function mint(address to, uint256 amount)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
    "event Transfer(address indexed from, address indexed to, uint256 value)"
];
const address_trustpay = "0xe9f5200A3B9776Ddbc623Db80aaf313705525ee0";
const address_token = "0x5D2aB2759bD686255A1DE02A6ffe1C5F8dD03Ac4";

function listenTradeStatusChange(contract_smartpay, account_address) {
    let filter = contract_smartpay.filters.TradeStatusChange(account_address, null);
    contract_smartpay.on(filter, (creator, payer, id, amount, status) => {
        let trade = {
            "id": ethers.BigNumber.from(id).toString(),
            "creator": creator,
            "payer": payer,
            "amount": ethers.BigNumber.from(amount).toString(),
            "status": status
        };
        updateTrade(trade, (status) => {
            getHistory();
        });
    });
}
function listenTokenTransferChange(contract_token) {
    let filter = contract_token.filters.Transfer(account, null);
    contract_token.once(filter, (from, to, amount) => {
        console.log(`from ${from} to ${to}=> ${amount} ESB`);
    });
}
async function addTrade() {
    try {
        const signer = this.provider.getSigner();
        const contract_smartpay = new ethers.Contract(address_trustpay, abiTrustpay, signer);
        await contract_smartpay.addTrade(parseFloat($("#amount").val()) * 10 ** 6);
        $("#btnSubmit").text("loading");
        listenTradeStatusChange(contract_smartpay, account);
    } catch (err) {
        console.log(err);
    }
}
async function getBalance() {
    try {
        const signer = this.provider.getSigner();
        const contract_token = new ethers.Contract(address_token, abiERC20, signer);
        let balance_erc20 = await contract_token.balanceOf(account);
        let etherString = ethers.utils.formatUnits(ethers.BigNumber.from(balance_erc20), 6);
        $("#balance").text(etherString + " ESB");
    } catch (error) {
        console.log(error);
    }
}
async function updateTrade(trade, callback) {
    if (typeof account != "undefined") {
        try {
            let trades = JSON.parse(localStorage.getItem(account) ?? "[]");
            let _trade;
            let i;
            for (i = 0; i < trades.length; i++) {
                const _item = trades[i];
                if (_item.id.toString() == trade.id.toString()) {
                    _trade = _item;
                    break;
                }
            }

            if (_trade) {
                trades[i].status = trade.status;
                trades[i].payer = trade.payer;
            } else {
                trades.unshift(trade);
            }
            localStorage.setItem(account, JSON.stringify(trades));
            callback(trade.status);
        } catch (error) {
            console.log(error)
        }
    }
}
function mint() {
    try {
        const signer = this.provider.getSigner();
        const contract_token = new ethers.Contract(address_token, abiERC20, signer);
        contract_token.mint(account, 1000 * 10 ** 6);
        listenTokenTransferChange(contract_token);
    } catch (error) {
        console.log(error);
    }
}
function getHistory() {
    list = JSON.parse(localStorage.getItem(account));
    console.log(list);
    $("#historyList").empty();

    if (list == null) return;
    for (let index = list.length - 1; index >= 0; index--) {
        const trade = list[index];
        var statusHTML = "";
        switch (trade.status) {
            case 1:
                statusHTML = '<label class="badge badge-warning">Pending</label>';
                break;
            case 2:
                statusHTML = '<label class="badge badge-success">Payed</label>';
                break;
            case 3:
                statusHTML = '<label class="badge badge-info">Withdrawed</label>';
                break;

            default:
                statusHTML = "";
                break;
        }
        let amountString = ethers.utils.formatUnits(ethers.BigNumber.from(trade.amount), 6);
        let htmlList = `<tr><td><a href="#" onclick='updateTradeStatus(${trade.id})'>${trade.id}</a></td>
        <td>${mask(trade.creator)}</td>
        <td>${mask(trade.payer)}</td>
        <td>${amountString}</td>
        <td>${statusHTML}</td>`;
        if (trade.creator.toString().toLowerCase() == account.toString().toLowerCase() && trade.status == 2) {
            htmlList += `<td><a href='#' onclick='Withdraw(${trade.id})'>Withdraw</a></td></tr>`;
        } else if (trade.payer.toString().toLowerCase() == account.toString().toLowerCase() && trade.status == 2) {
            htmlList += `<td><a href='#' onclick='getVerifyCode(${trade.id})'>VerifyCode</a></td></tr>`;
        } else if (trade.creator.toString().toLowerCase() != account.toString().toLowerCase() && trade.status == 1) {
            htmlList += `<td><a href='#' onclick='Pay(${trade.id},${trade.amount})'>Pay</a></td></tr>`;
        } else {
            htmlList += `<td></td></tr>`;
        }
        $("#historyList").append(htmlList);
    }
}

async function getTrade() {
    try {
        const signer = this.provider.getSigner();
        const contract_smartpay = new ethers.Contract(address_trustpay, abiTrustpay, signer);
        let result = await contract_smartpay.getTrade($("#trade_id").val());
        let trade = {};
        trade.id = $("#trade_id").val();
        trade.creator = result[0];
        trade.payer = result[1];
        trade.amount = ethers.BigNumber.from(result[2]).toString();
        trade.status = result[3];
        if (trade.status != 1) {
            window.confirm("this trade is not pending");
            return;
        }
        updateTrade(trade, (status) => {
            getHistory();
            $("#amount").val(ethers.utils.formatUnits(ethers.BigNumber.from(trade.amount), 6));
            $("#receiver").val(trade.creator);
        });
    } catch (error) {
        console.log(error);
    }
}
async function Pay(trade_id, amount) {
    try {
        const signer = this.provider.getSigner();
        const contract_token = new ethers.Contract(address_token, abiERC20, signer);
        const contract_smartpay = new ethers.Contract(address_trustpay, abiTrustpay, signer);

        let isApprove = await contract_token.approve(address_trustpay, amount);
        if (isApprove) {

            contract_smartpay.executeTrade(trade_id);
            getBalance();
            listenTokenTransferChange(contract_token);
            listenTradeStatusChange(contract_smartpay, account);
        }
    } catch (error) {
        console.log(error);
    }
}
function Withdraw(trade_id) {
    try {
        var verifyCode = prompt("VerifyCode");
        if (verifyCode) {

            const signer = this.provider.getSigner();
            const contract_token = new ethers.Contract(address_token, abiERC20, signer);
            const contract_smartpay = new ethers.Contract(address_trustpay, abiTrustpay, signer);
            contract_smartpay.withdrawTrade(trade_id, verifyCode);
            getBalance();
            listenTradeStatusChange(contract_smartpay, account);
            listenTokenTransferChange(contract_token);
        }
    } catch (error) {
        console.log(error);
    }
}
async function getVerifyCode(trade_id) {

    const signer = this.provider.getSigner();
    const contract_smartpay = new ethers.Contract(address_trustpay, abiTrustpay, signer);
    var result = await contract_smartpay.getVerify(trade_id);
    window.confirm(result);
}
async function updateTradeStatus(trade_id) {
    try {
        const signer = this.provider.getSigner();
        const contract_smartpay = new ethers.Contract(address_trustpay, abiTrustpay, signer);
        let result = await contract_smartpay.getTrade(trade_id);

        let trade = {
            "id": trade_id,
            "payer": result[1],
            "status": result[3]
        };
        console.log(trade);
        updateTrade(trade, (status) => {
            getHistory();
        });
    } catch (error) {

    }
}
