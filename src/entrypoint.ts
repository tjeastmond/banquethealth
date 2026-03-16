import triggerSmartOrderSystem from "./smartOrder"

triggerSmartOrderSystem()
    .then(() => {
        console.log('Done')
    })
    .catch((error: Error) => {
        console.error('Something went wrong')
        console.error(error)
})
