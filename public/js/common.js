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
    this.provider.getBalance(account).then((balance) => {
        // 余额是 BigNumber (in wei); 格式化为 ether 字符串
        let etherString = parseFloat(ethers.utils.formatEther(balance)).toFixed(4);
        $("#balance").text(etherString + " ETH");
    });
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
            console.log(`your trade ${id} status change to ${status}`);
            alert(`Trade ${id} update status ${status}`);
        });
    });
}
function listenTokenTransferChange(contract_token) {
    let filter = contract_token.filters.Transfer(null, account);
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
        console.log("your ESB balance:" + etherString);
    } catch (error) {
        console.log(error);
    }
}
async function updateTrade(trade, callback) {
    if (typeof account != "undefined") {
        try {
            let trades = JSON.parse(localStorage.getItem(account) ?? "[]");
            let _trade;
            for (let i = 0; i < trades.length; i++) {
                const _item = trades[i];
                if (_item.id == trade.id) {
                    _trade = _item;
                    break;
                }
            }
            if (_trade && _trade.status != trade.status) {
                trades[i] = trade;
            } else if (typeof _trade == "undefined") {
                trades.unshift(trade);
            } else {
                return;
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
        $("#historyList").append(`<tr><td>${trade.id}</td>
        <td>${mask(trade.creator)}</td>
        <td>${mask(trade.payer)}</td>
        <td>${amountString}</td>
        <td>${statusHTML}</td>
        <td><a href='#' onclick='withdraw(${trade.id})'>withdraw</a></td></tr>`);
    }
}